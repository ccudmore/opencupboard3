import { z } from 'zod';
import prisma from '$lib/prisma';
import type { Prisma } from '$prisma/client';
import type { ExpenseCategory, ExpensePaymentMethod, ExpenseStatus, ReimbursementMethod } from '$prisma/enums';
import { notify, notifyPermission } from '$lib/server/notifications';
import { ALLOWED_EXTENSIONS, cleanFileName, identifyDocument, maxUploadBytes } from '$lib/server/documentTypes';
import { CATEGORIES, PAYMENT_METHODS, REIMBURSEMENT_METHODS, STATUSES, money, dateOnly } from '$lib/expenses';

export type Fail = { ok: false; status: number; message: string };
export type Result<T = object> = ({ ok: true } & T) | Fail;
const fail = (status: number, message: string): Fail => ({ ok: false, status, message });

export const MAX_RECEIPTS = 10;
export const MAX_ROWS = 500;

const oneOf = <T extends readonly { value: string }[]>(list: T) => list.map((x) => x.value) as [string, ...string[]];

/** "12.34", "$1,234.5" or "12" as cents, or null when it isn't an amount. */
export function parseMoney(raw: string): number | null {
	const cleaned = raw.replace(/[\s$,]/g, '');
	if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
	return Math.round(Number(cleaned) * 100);
}

const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.')
	.refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Choose a valid date.');

const submitSchema = z.object({
	purchaseDate: isoDate.refine((s) => s <= new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10), 'The purchase date can not be in the future.'),
	vendor: z.string().trim().min(1, 'Enter the store or vendor.').max(120, 'Use at most 120 characters for the vendor.'),
	description: z.string().trim().min(1, 'Enter a description.').max(300, 'Use at most 300 characters for the description.'),
	amount: z.string().transform((s, ctx) => {
		const cents = parseMoney(s);
		if (cents === null || cents <= 0) ctx.addIssue({ code: 'custom', message: 'Enter the amount, for example 24.50.' });
		return cents ?? 0;
	}),
	tax: z.string().optional().transform((s, ctx) => {
		if (!s || !s.trim()) return null;
		const cents = parseMoney(s);
		if (cents === null) ctx.addIssue({ code: 'custom', message: 'Enter the tax as an amount, for example 2.10, or leave it empty.' });
		return cents;
	}),
	categories: z.array(z.enum(oneOf(CATEGORIES))).min(1, 'Choose at least one category.'),
	categoryOther: z.string().trim().max(200, 'Use at most 200 characters to explain "Other".').optional(),
	paymentMethod: z.enum(oneOf(PAYMENT_METHODS), { error: 'Choose how it was paid.' }),
	notes: z.string().trim().max(1000, 'Use at most 1000 characters for the notes.').optional()
});

/** Reads the fields of the form. Categories arrive as repeated "categories" values. */
function readFields(data: FormData) {
	return {
		purchaseDate: String(data.get('purchaseDate') ?? ''),
		vendor: String(data.get('vendor') ?? ''),
		description: String(data.get('description') ?? ''),
		amount: String(data.get('amount') ?? ''),
		tax: String(data.get('tax') ?? ''),
		categories: data.getAll('categories').map(String),
		categoryOther: String(data.get('categoryOther') ?? ''),
		paymentMethod: String(data.get('paymentMethod') ?? ''),
		notes: String(data.get('notes') ?? '')
	};
}

/** Creates a pending expense. Receipts are added afterwards, one request each, so each is checked on its own. */
export async function createExpense(userId: string, data: FormData): Promise<Result<{ id: string }>> {
	const parsed = submitSchema.safeParse(readFields(data));
	if (!parsed.success) return fail(400, parsed.error.issues[0].message);
	const v = parsed.data;
	if (v.categories.includes('OTHER') && !v.categoryOther) return fail(400, 'You chose "Other". Explain what it was.');
	if (v.tax !== null && v.tax > v.amount) return fail(400, 'The tax can not be more than the amount.');

	const submitter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
	const expense = await prisma.expense.create({
		data: {
			submittedById: userId,
			purchaseDate: new Date(`${v.purchaseDate}T00:00:00Z`),
			vendor: v.vendor,
			description: v.description,
			amountCents: v.amount,
			taxCents: v.tax,
			categories: [...new Set(v.categories)] as ExpenseCategory[],
			categoryOther: v.categories.includes('OTHER') ? v.categoryOther : null,
			paymentMethod: v.paymentMethod as ExpensePaymentMethod,
			notes: v.notes || null
		},
		select: { id: true }
	});

	await notifyPermission(
		'manage-expenses',
		{
			subject: `New expense from ${submitter?.name ?? 'a user'}: ${money(v.amount)} at ${v.vendor}`,
			body: v.description,
			link: '/expenses',
			createdBy: userId
		},
		{ exceptUserId: userId }
	);
	return { ok: true, id: expense.id };
}

/** Adds one receipt. The submitter can add them while the expense is pending; managers any time. */
export async function addReceipt(expenseId: string, userId: string, canManage: boolean, file: unknown): Promise<Result<{ id: string }>> {
	if (!(file instanceof File) || file.size === 0) return fail(400, 'Choose a file to upload.');
	if (file.size > maxUploadBytes()) return fail(413, `That file is larger than ${Math.round(maxUploadBytes() / 1024 / 1024)} MB.`);

	const expense = await prisma.expense.findUnique({
		where: { id: expenseId },
		select: { submittedById: true, status: true, _count: { select: { receipts: true } } }
	});
	if (!expense || (expense.submittedById !== userId && !canManage)) return fail(404, 'That expense no longer exists.');
	if (!canManage && expense.status !== 'PENDING') return fail(409, 'Receipts can only be added while the expense is pending.');
	if (expense._count.receipts >= MAX_RECEIPTS) return fail(400, `An expense can have up to ${MAX_RECEIPTS} receipts.`);

	const bytes = new Uint8Array(await file.arrayBuffer());
	const name = cleanFileName(file.name);
	const type = identifyDocument(name, bytes);
	if (!type) return fail(400, `${name}: that file type isn't allowed, or the file doesn't match its name. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`);

	const receipt = await prisma.expenseReceipt.create({
		data: { expenseId, name, contentType: type.contentType, size: bytes.byteLength, content: bytes },
		select: { id: true }
	});
	return { ok: true, id: receipt.id };
}

export async function deleteReceipt(receiptId: string, userId: string, canManage: boolean): Promise<Result> {
	const receipt = await prisma.expenseReceipt.findUnique({ where: { id: receiptId }, select: { expense: { select: { submittedById: true, status: true } } } });
	if (!receipt || (receipt.expense.submittedById !== userId && !canManage)) return fail(404, 'That receipt no longer exists.');
	if (!canManage && receipt.expense.status !== 'PENDING') return fail(409, 'Receipts can only be removed while the expense is pending.');
	await prisma.expenseReceipt.deleteMany({ where: { id: receiptId } });
	return { ok: true };
}

// ---------------------------------------------------------------- lists

const listSelect = {
	id: true,
	purchaseDate: true,
	vendor: true,
	description: true,
	amountCents: true,
	taxCents: true,
	categories: true,
	categoryOther: true,
	paymentMethod: true,
	notes: true,
	status: true,
	reviewedAt: true,
	reviewNote: true,
	reimbursedOn: true,
	reimbursementMethod: true,
	reimbursementNote: true,
	createdAt: true,
	submittedById: true,
	submittedBy: { select: { name: true } },
	receipts: { select: { id: true, name: true, size: true, contentType: true }, orderBy: { createdAt: 'asc' } }
} satisfies Prisma.ExpenseSelect;

type Row = Prisma.ExpenseGetPayload<{ select: typeof listSelect }>;

/** Dates are sent to the browser as plain "2026-11-04" text, so no time zone can shift them. */
function shape(r: Row) {
	return {
		id: r.id,
		purchaseDate: r.purchaseDate.toISOString().slice(0, 10),
		vendor: r.vendor,
		description: r.description,
		amountCents: r.amountCents,
		taxCents: r.taxCents,
		categories: r.categories as string[],
		categoryOther: r.categoryOther ?? '',
		paymentMethod: r.paymentMethod as string,
		notes: r.notes ?? '',
		status: r.status as string,
		reviewedAt: r.reviewedAt?.toISOString() ?? null,
		reviewNote: r.reviewNote ?? '',
		reimbursedOn: r.reimbursedOn?.toISOString().slice(0, 10) ?? null,
		reimbursementMethod: (r.reimbursementMethod as string | null) ?? null,
		reimbursementNote: r.reimbursementNote ?? '',
		submittedAt: r.createdAt.toISOString(),
		submitterId: r.submittedById,
		submitterName: r.submittedBy.name,
		receipts: r.receipts
	};
}
export type ExpenseRow = ReturnType<typeof shape>;

/** Everything one user has submitted, newest purchase first. */
export async function listMine(userId: string): Promise<ExpenseRow[]> {
	const rows = await prisma.expense.findMany({
		where: { submittedById: userId },
		select: listSelect,
		orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
		take: MAX_ROWS
	});
	return rows.map(shape);
}

export type ManagerFilters = { pendingOnly: boolean; from?: string; to?: string };

/** Expenses for managers: all of them, or just the pending ones, within an optional purchase-date range. */
export async function listAll({ pendingOnly, from, to }: ManagerFilters) {
	const range: Prisma.DateTimeFilter = {};
	if (from) range.gte = new Date(`${from}T00:00:00Z`);
	if (to) range.lte = new Date(`${to}T00:00:00Z`);
	const where: Prisma.ExpenseWhereInput = {
		...(pendingOnly ? { status: 'PENDING' } : {}),
		...(from || to ? { purchaseDate: range } : {})
	};
	const [rows, total, sum] = await Promise.all([
		prisma.expense.findMany({ where, select: listSelect, orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }], take: MAX_ROWS }),
		prisma.expense.count({ where }),
		prisma.expense.aggregate({ where, _sum: { amountCents: true } })
	]);
	return { expenses: rows.map(shape), total, totalCents: sum._sum.amountCents ?? 0 };
}

export const validDateParam = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : '');

// ---------------------------------------------------------------- decisions

const decisionSchema = z.object({
	status: z.enum(oneOf(STATUSES)),
	reviewNote: z.string().trim().max(500, 'Use at most 500 characters for the note.').optional(),
	reimbursedOn: z.string().optional(),
	reimbursementMethod: z.string().optional(),
	reimbursementNote: z.string().trim().max(300, 'Use at most 300 characters for the reimbursement note.').optional()
});

/** A manager's decision: back to pending, approve, reject, or mark reimbursed (with the date and how). */
export async function decide(expenseId: string, managerId: string, data: FormData): Promise<Result> {
	const parsed = decisionSchema.safeParse(Object.fromEntries([...data.entries()].filter(([, v]) => typeof v === 'string')));
	if (!parsed.success) return fail(400, parsed.error.issues[0].message);
	const d = parsed.data;

	let reimbursedOn: Date | null = null;
	let method: ReimbursementMethod | null = null;
	if (d.status === 'REIMBURSED') {
		const date = isoDate.safeParse(d.reimbursedOn ?? '');
		if (!date.success) return fail(400, 'Choose the date it was reimbursed.');
		const m = REIMBURSEMENT_METHODS.find((x) => x.value === d.reimbursementMethod);
		if (!m) return fail(400, 'Choose how it was reimbursed.');
		reimbursedOn = new Date(`${date.data}T00:00:00Z`);
		method = m.value as ReimbursementMethod;
	}
	if (d.status === 'REJECTED' && !d.reviewNote) return fail(400, 'Say why it was rejected, so the person knows.');

	const before = await prisma.expense.findUnique({ where: { id: expenseId }, select: { status: true, submittedById: true, vendor: true, amountCents: true } });
	if (!before) return fail(404, 'That expense no longer exists.');

	await prisma.expense.update({
		where: { id: expenseId },
		data: {
			status: d.status as ExpenseStatus,
			reviewedBy: d.status === 'PENDING' ? null : managerId,
			reviewedAt: d.status === 'PENDING' ? null : new Date(),
			reviewNote: d.reviewNote || null,
			reimbursedOn,
			reimbursementMethod: method,
			reimbursementNote: d.status === 'REIMBURSED' ? d.reimbursementNote || null : null
		}
	});

	if (before.status !== d.status && d.status !== 'PENDING' && before.submittedById !== managerId) {
		const label = STATUSES.find((s) => s.value === d.status)?.label.toLowerCase();
		await notify(before.submittedById, {
			subject: `Your ${money(before.amountCents)} expense at ${before.vendor} was ${label}`,
			body:
				d.status === 'REIMBURSED' && reimbursedOn
					? `Reimbursed on ${dateOnly(reimbursedOn)} by ${REIMBURSEMENT_METHODS.find((x) => x.value === method)?.label.toLowerCase()}.`
					: d.reviewNote || undefined,
			link: '/expenses',
			createdBy: managerId
		});
	}
	return { ok: true };
}

/** A receipt, if this person may see it: they submitted the expense, or they manage expenses. */
export async function receiptFor(receiptId: string, userId: string, canManage: boolean) {
	const receipt = await prisma.expenseReceipt.findUnique({ where: { id: receiptId }, include: { expense: { select: { submittedById: true } } } });
	if (!receipt) return null;
	return receipt.expense.submittedById === userId || canManage ? receipt : null;
}
