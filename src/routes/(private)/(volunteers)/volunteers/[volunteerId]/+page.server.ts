import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Prisma } from '$prisma/client';
import prisma from '$lib/prisma';
import { requirePermission } from '$lib/utils';
import { volunteerSchema, readAvailability, readTrainingCourses } from '$lib/formschemas/volunteer';
import { ALLOWED_EXTENSIONS, identifyDocument, cleanFileName, maxUploadBytes } from '$lib/server/documentTypes';
import { EventStatus } from '$prisma/enums';
import { isMailConfigured } from '$lib/server/email/mailer';
import {
	createAssignment,
	updateAssignment,
	deleteAssignment,
	previewAssignmentEmail,
	sendAssignmentMessage
} from '$lib/server/assignmentActions';

/** Most documents one volunteer can have. */
const MAX_DOCUMENTS = 25;

const uploadSettings = () => ({
	accept: ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(','),
	maxMb: Math.round(maxUploadBytes() / 1024 / 1024)
});

/** The URL /volunteers/new adds a volunteer; any other value is a volunteer's id. */
const NEW = 'new';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);

	if (params.volunteerId === NEW) {
		return {
			isNew: true,
			form: await superValidate(zod4(volunteerSchema)),
			assignments: [],
			events: [],
			emailEnabled: isMailConfigured(),
			assignmentCount: 0,
			documents: [],
			...uploadSettings()
		};
	}

	const volunteer = await prisma.volunteer.findUnique({
		where: { id: params.volunteerId },
		include: {
			_count: { select: { assignments: true } },
			documents: {
				orderBy: { createdAt: 'desc' },
				select: { id: true, name: true, size: true, contentType: true, createdAt: true }
			}
		}
	});
	if (!volunteer) throw error(404, 'Volunteer not found');

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { availability, trainingCourses, attachments: _links, documents, ...rest } = volunteer;
	const form = await superValidate(
		{
			...rest,
			availability: readAvailability(availability),
			trainingCourses: readTrainingCourses(trainingCourses)
		},
		zod4(volunteerSchema)
	);

	// Everything this volunteer is assigned to, most recent event first
	const assignments = (
		await prisma.volunteerAssignments.findMany({
			where: { volunteerId: volunteer.id },
			include: { event: { include: { location: true } } },
			orderBy: { event: { startTime: 'desc' } }
		})
	).map((a) => ({
		id: a.id,
		eventId: a.eventId,
		title: a.event.title ?? a.event.type,
		type: a.event.type,
		startTime: a.event.startTime,
		endTime: a.event.endTime,
		location: a.event.location.name,
		role: a.eventRole,
		status: a.status,
		confirmations: a.confirmations,
		reminders: a.reminders,
		cancellations: a.cancellations
	}));

	return {
		isNew: false,
		form,
		assignments,
		events: await eventsToChooseFrom(),
		emailEnabled: isMailConfigured(),
		assignmentCount: assignments.length,
		documents,
		...uploadSettings()
	};
};

/**
 * Events a volunteer can be added to: those from a year ago on that aren't cancelled.
 * Upcoming ones first (soonest first), then past ones (most recent first).
 */
async function eventsToChooseFrom() {
	const now = new Date();
	const yearAgo = new Date(now);
	yearAgo.setFullYear(yearAgo.getFullYear() - 1);

	const events = await prisma.event.findMany({
		where: { status: EventStatus.ACTIVE, startTime: { gte: yearAgo } },
		include: { location: { select: { name: true } } },
		orderBy: { startTime: 'asc' },
		take: 1000
	});
	const rows = events.map((e) => ({
		id: e.id,
		title: e.title ?? e.type,
		type: e.type,
		startTime: e.startTime,
		endTime: e.endTime,
		location: e.location.name
	}));
	const upcoming = rows.filter((e) => e.startTime >= now);
	const past = rows.filter((e) => e.startTime < now).reverse();
	return [...upcoming, ...past];
}

export const actions: Actions = {
	/** Creates a volunteer (/volunteers/new) or updates one. */
	save: async ({ request, params, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);

		const form = await superValidate(request, zod4(volunteerSchema));
		if (!form.valid) return fail(400, { form });

		const { availability, trainingCourses, ...fields } = form.data;
		const data = {
			...fields,
			availability: availability as Prisma.InputJsonValue,
			trainingCourses: trainingCourses as Prisma.InputJsonValue
		};

		if (params.volunteerId === NEW) {
			let id: string;
			try {
				id = (await prisma.volunteer.create({ data: { ...data, createdBy: locals.user?.id ?? 'system' } })).id;
			} catch (err) {
				console.error(err);
				return message(form, 'Could not save the volunteer. Please try again.', { status: 500 });
			}
			throw redirect(303, `/volunteers/${id}`);
		}

		try {
			await prisma.volunteer.update({ where: { id: params.volunteerId }, data });
		} catch (err) {
			if ((err as { code?: string }).code === 'P2025') {
				return message(form, 'This volunteer no longer exists.', { status: 404 });
			}
			console.error(err);
			return message(form, 'Could not save the volunteer. Please try again.', { status: 500 });
		}
		return message(form, 'Saved');
	},

	/** Removes a volunteer and their event assignments. */
	delete: async ({ params, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);
		if (params.volunteerId === NEW) return fail(400, { message: 'Nothing to delete.' });

		try {
			// The volunteer's documents go with them (cascade)
			await prisma.$transaction([
				prisma.volunteerAssignments.deleteMany({ where: { volunteerId: params.volunteerId } }),
				prisma.volunteer.delete({ where: { id: params.volunteerId } })
			]);
		} catch (err) {
			if ((err as { code?: string }).code !== 'P2025') {
				console.error(err);
				return fail(500, { message: 'Could not delete the volunteer. Please try again.' });
			}
			// already gone: fall through to the list
		}
		throw redirect(303, '/volunteers');
	},

	/** Stores an uploaded file for this volunteer. */
	uploadDocument: async ({ request, params, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);
		if (params.volunteerId === NEW) return fail(400, { message: 'Save the volunteer first.' });

		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { message: 'Choose a file to upload.' });
		if (file.size > maxUploadBytes()) {
			return fail(413, { message: `That file is larger than ${uploadSettings().maxMb} MB.` });
		}

		const volunteer = await prisma.volunteer.findUnique({
			where: { id: params.volunteerId },
			select: { id: true, _count: { select: { documents: true } } }
		});
		if (!volunteer) return fail(404, { message: 'This volunteer no longer exists.' });
		if (volunteer._count.documents >= MAX_DOCUMENTS) {
			return fail(400, { message: `A volunteer can have up to ${MAX_DOCUMENTS} documents.` });
		}

		const bytes = new Uint8Array(await file.arrayBuffer());
		const name = cleanFileName(file.name);
		const type = identifyDocument(name, bytes);
		if (!type) {
			return fail(400, {
				message: `That file type isn't allowed, or the file doesn't match its name. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`
			});
		}

		try {
			await prisma.volunteerDocument.create({
				data: {
					volunteerId: volunteer.id,
					name,
					contentType: type.contentType,
					size: bytes.byteLength,
					content: bytes,
					createdBy: locals.user?.id ?? 'system'
				}
			});
		} catch (err) {
			console.error(err);
			return fail(500, { message: 'Could not store the file. Please try again.' });
		}
		return { uploaded: true };
	},

	/** Deletes one of this volunteer's documents, and its file. */
	deleteDocument: async ({ request, params, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);

		const documentId = String((await request.formData()).get('documentId') ?? '');
		// both ids must match, so a document can't be deleted through another volunteer's page
		const doc = await prisma.volunteerDocument.findFirst({
			where: { id: documentId, volunteerId: params.volunteerId },
			select: { id: true }
		});
		if (!doc) return fail(404, { message: 'That document no longer exists.' });

		try {
			await prisma.volunteerDocument.delete({ where: { id: doc.id } });
		} catch (err) {
			if ((err as { code?: string }).code !== 'P2025') {
				console.error(err);
				return fail(500, { message: 'Could not delete the document. Please try again.' });
			}
		}
		return { deleted: true };
	},

	// ---- Event assignments (called with fetch from Assignments.svelte) ----

	createAssignment: async ({ request, params, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);
		return createAssignment(params.volunteerId, locals.user?.id, await request.formData());
	},

	updateAssignment: async ({ request, params, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);
		return updateAssignment(params.volunteerId, await request.formData());
	},

	deleteAssignment: async ({ request, params, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);
		return deleteAssignment(params.volunteerId, await request.formData());
	},

	previewEmail: async ({ request, params, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);
		return previewAssignmentEmail(params.volunteerId, await request.formData());
	},

	sendEmail: async ({ request, params, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);
		return sendAssignmentMessage(params.volunteerId, locals.user?.id, await request.formData());
	}
};
