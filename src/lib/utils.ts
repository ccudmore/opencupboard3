import { env } from '$env/dynamic/public';
import type { BookingWithAppointment, HouseholdWithRelations, HouseholdMember} from "./types/household";
import { error, redirect } from '@sveltejs/kit';

export function formattedDate(date: Date | undefined | null) {
	return  date?.toLocaleDateString("en-CA") // get from environment variable
}

export function formattedDateTime(date: Date | undefined | null) {
	const dt: string = formattedDate(date) + ' ' + formattedTime(date)
	return dt
}

export function formattedTime(date: Date | undefined | null) {
	return  date?.toLocaleTimeString("en-CA") // get from environment variable
}

export function calculateFamilySize(family: readonly HouseholdMember[]): string {

	let familySize: string = ''
	if (family.length == 1) familySize = 'Single'
	else if (family.length <= 3) familySize = 'Small'
	else if (family.length <= 5) familySize = 'Medium'
	else familySize = 'Large'

	return familySize
}

export function calculateChildCount(family: readonly HouseholdMember[]): number {
	const currentYear = new Date().getFullYear()
	const now = new Date()
	const year = now.getFullYear();

	return family.filter((m) => m.birthYear != null && year - m.birthYear < 13).length;
}

function getIdValidityMillis() {
	let idCheckIntervalMonths: number = 12
	if ("PUBLIC_ID_RENEWAL_PERIOD_MONTHS" in env) {
		idCheckIntervalMonths = +(env.PUBLIC_ID_RENEWAL_PERIOD_MONTHS??"12")
	}
	const idCheckIntervalMillis = 1000*60*60*24*30.4*idCheckIntervalMonths
	return idCheckIntervalMillis

}// default 12 months

export function nextIdVerificationDate(date: Date) {
	return formattedDate(new Date(date.getTime()+getIdValidityMillis()))
}

export function isIdVerificationNeeded(date: Date | undefined | null) {
	const now = new Date().getTime()
	return (date == null || (date.getTime() + getIdValidityMillis()) < now )
}

export function calculateNextServiceDate(bookings: BookingWithAppointment[]) {
	return new Date();
}

export function calculateNextServiceDate2(bookings: BookingWithAppointment[]) {
	const times = (bookings as any[])
		.filter((b) => b.status !== 'Cancelled')
  		.map((b) => new Date(b.appointment.startTime).getTime());

	if (times.length === 0) {
		return null
	}

	// Latest appointment start time
	const latest = new Date(Math.max(...times));

	// Monday of that week (weeks run Mon-Sun), then + 4 weeks
	const result = new Date(latest);
	const daysSinceMonday = (result.getDay() + 6) % 7; // Mon=0 ... Sun=6
	result.setDate(result.getDate() - daysSinceMonday + 4 * 7); // craig - make number of weeks configurable
	result.setHours(0, 0, 0, 0); // midnight at the start of that Monday

	// Eligible date has already passed, so no waiting period applies
	if (result.getTime() < Date.now()) {
    	return null;
	}

	return result
}

function haveCommonElement(arr1: string[], arr2: string[]): boolean {
  const set2 = new Set(arr2);
  return arr1.some(element => set2.has(element));
}

export function hasPermission( permissions: string[] | null | undefined, requestedPermissions: string[]) {
	return (permissions && haveCommonElement(requestedPermissions, permissions))
}

export function requirePermission( permissions: string[] | null | undefined, url: URL, requiredPermissions: string[]) {

  	if (!permissions) {
    	throw redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  	}

	if (!haveCommonElement(requiredPermissions, permissions)) {
		throw error(403, 'You do not have permission to view this page');
  	}
}

export function requireRole( locals: App.Locals, url: URL, allowedRoles: string[]) {
  const user = locals.user;

  if (!user) {
    throw redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }

  if (!haveCommonElement(allowedRoles, user.roles)) {
    throw error(403, 'You do not have permission to view this page');
  }

  return user;
}
