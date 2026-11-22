import {
	QuestionCircleSolid,
	HeartSolid,
	StarSolid,
	BellSolid,
	ClipboardListSolid,
	BookmarkSolid,
	FlagSolid,
	LightbulbSolid,
	HomeSolid,
	PhoneSolid,
	EnvelopeSolid,
	FireSolid,
	ExclamationCircleSolid,
	InfoCircleSolid,
	TagSolid,
	ClockSolid,
	UsersSolid,
	MessagesSolid,
	CartSolid
} from 'flowbite-svelte-icons';
import { DATED_REQUEST_TYPES } from '$app/env/public';

/** Icon names that can be used in the DATED_REQUEST_TYPES environment variable. */
export const datedRequestIcons = {
	QuestionCircle: QuestionCircleSolid,
	Heart: HeartSolid,
	Star: StarSolid,
	Bell: BellSolid,
	ClipboardList: ClipboardListSolid,
	Bookmark: BookmarkSolid,
	Flag: FlagSolid,
	Lightbulb: LightbulbSolid,
	Home: HomeSolid,
	Phone: PhoneSolid,
	Envelope: EnvelopeSolid,
	Fire: FireSolid,
	ExclamationCircle: ExclamationCircleSolid,
	InfoCircle: InfoCircleSolid,
	Tag: TagSolid,
	Clock: ClockSolid,
	Users: UsersSolid,
	Messages: MessagesSolid,
	Cart: CartSolid
} as const;

export const DEFAULT_DATED_REQUEST_ICON = QuestionCircleSolid;

export type DatedRequestType = {
	/** Shown on the tab, and stored as DatedRequest.type */
	name: string;
	icon: typeof QuestionCircleSolid;
};

/**
 * Parses "Special Requests:QuestionCircle, Prayer Requests:Heart" into a list of tabs.
 * The icon is optional; an unknown icon name uses the default. Duplicate names are ignored.
 * Unset or empty gives a single "Special Requests" tab.
 */
export function parseDatedRequestTypes(raw: string | undefined | null): DatedRequestType[] {
	const out: DatedRequestType[] = [];
	for (const part of (raw ?? '').split(',')) {
		const [rawName, rawIcon] = part.split(':');
		const name = rawName?.trim();
		if (!name || out.some((t) => t.name.toLowerCase() === name.toLowerCase())) continue;
		const key = rawIcon?.trim() as keyof typeof datedRequestIcons;
		out.push({ name, icon: datedRequestIcons[key] ?? DEFAULT_DATED_REQUEST_ICON });
	}
	return out.length ? out : [{ name: 'Special Requests', icon: DEFAULT_DATED_REQUEST_ICON }];
}

export const datedRequestTypes = parseDatedRequestTypes(DATED_REQUEST_TYPES);
