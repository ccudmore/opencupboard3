import type { Prisma } from '$prisma/client';
import prisma from '$lib/prisma';

export const ADMIN_PAGE_SIZE = 25;

export type AdminSearchOptions = { q?: string; page?: number; pageSize?: number };

/** Turns URLSearchParams into search options so every page parses them the same way. */
export function parseAdminSearchParams(params: URLSearchParams): AdminSearchOptions {
	return {
		q: params.get('q')?.trim() ?? '',
		page: Math.max(1, Number(params.get('page')) || 1),
		pageSize: ADMIN_PAGE_SIZE
	};
}

const words = (q: string) => q.trim().split(/\s+/).filter(Boolean);

/** Users whose name, email or role name contain every word typed, by name, one page at a time. */
export async function searchUsers({ q = '', page = 1, pageSize = ADMIN_PAGE_SIZE }: AdminSearchOptions = {}) {
	const where: Prisma.UserWhereInput = {
		AND: words(q).map((word) => ({
			OR: [
				{ name: { contains: word, mode: 'insensitive' } },
				{ email: { contains: word, mode: 'insensitive' } },
				{ roles: { some: { role: { name: { contains: word, mode: 'insensitive' } } } } }
			]
		}))
	};

	const [total, users] = await Promise.all([
		prisma.user.count({ where }),
		prisma.user.findMany({
			where,
			orderBy: [{ name: 'asc' }, { email: 'asc' }],
			skip: (page - 1) * pageSize,
			take: pageSize,
			select: {
				id: true,
				name: true,
				email: true,
				status: true,
				createdAt: true,
				roles: { select: { role: { select: { id: true, name: true, status: true } } }, orderBy: { role: { name: 'asc' } } }
			}
		})
	]);

	return { users, total, page, pageSize, q: q.trim() };
}

/** Every role, for the checkboxes on the users page. */
export async function listRoles() {
	return prisma.role.findMany({ select: { id: true, name: true, status: true }, orderBy: { name: 'asc' } });
}

/** Roles whose name or description contain every word typed, by name, one page at a time. */
export async function searchRoles({ q = '', page = 1, pageSize = ADMIN_PAGE_SIZE }: AdminSearchOptions = {}) {
	const where: Prisma.RoleWhereInput = {
		AND: words(q).map((word) => ({
			OR: [
				{ name: { contains: word, mode: 'insensitive' } },
				{ description: { contains: word, mode: 'insensitive' } }
			]
		}))
	};

	const [total, roles] = await Promise.all([
		prisma.role.count({ where }),
		prisma.role.findMany({
			where,
			orderBy: { name: 'asc' },
			skip: (page - 1) * pageSize,
			take: pageSize,
			select: {
				id: true,
				name: true,
				description: true,
				status: true,
				permissions: { select: { permissionId: true } },
				_count: { select: { users: true } }
			}
		})
	]);

	return { roles, total, page, pageSize, q: q.trim() };
}

/** Every permission. They are defined in prisma/reference-data.ts, so they are chosen here, not created. */
export async function listPermissions() {
	return prisma.permission.findMany({ select: { id: true, name: true, description: true }, orderBy: { name: 'asc' } });
}
