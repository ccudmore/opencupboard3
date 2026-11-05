/** Where an event is: the site's name, or the place that was typed in. */
export function eventPlace(e: { location?: { name: string } | null; locationText?: string | null }): string {
	return e.location?.name ?? e.locationText ?? '';
}
