//import { clsx, type ClassValue } from "clsx";
//import { twMerge } from "tailwind-merge";
import { env } from '$env/dynamic/public';
import type { BookingWithAppointment, HouseholdWithRelations, HouseholdMember} from "./types/household";

/*
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
	*/

	/*
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
*/
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
