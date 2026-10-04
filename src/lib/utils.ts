import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { env } from '$env/dynamic/public';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

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

export function calculateFamilySize(family: any) {
	let familySize: string = ''
	if (family.length == 1) familySize = 'Single'
	else if (family.length <= 3) familySize = 'Small'
	else if (family.length <= 5) familySize = 'Medium'
	else familySize = 'Large'

	return familySize
}

export function calculateChildCount(family: any[]) {
	const currentYear = new Date().getFullYear()
	return family.filter((el) => (currentYear - el.birthYear) < 13).length
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
