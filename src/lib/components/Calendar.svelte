<script module lang="ts">
	export interface CalendarEvent {
		id?: string;
		title: string;
		location?: string;
		/** Date or anything `new Date()` accepts (ISO string). */
		start: Date | string;
		end: Date | string;
		/** Must match a `name` in the categories list. */
		category: string;
		/** Repeats on a schedule (see below). Repeating events show a repeat icon. */
		repeating?: boolean;
		/** Repeat every N days/weeks. Default 1. */
		repeatEvery?: number;
		/** Unit for `repeatEvery`. Default 'week'. */
		repeatUnit?: 'day' | 'week';
		/** Last date (inclusive) the event can occur on. Omit to repeat forever. A Date or 'YYYY-MM-DD'. */
		repeatUntil?: Date | string;
		/** Dates ('YYYY-MM-DD') of single occurrences that were deleted from the series. */
		exceptions?: string[];
		/**
		 * Volunteers signed up for the event: ids from the `volunteers` prop, optionally with a
		 * role from the event's category. A bare id string means "no role".
		 */
		volunteers?: (string | EventVolunteer)[];
	}

	export interface EventVolunteer {
		id: string;
		role?: string;
	}

	/** An available volunteer. Events store the `id`. */
	export interface Volunteer {
		id: string;
		firstName: string;
		lastName: string;
	}

	export interface CalendarCategory {
		name: string;
		color: string;
		/** Roles volunteers can be given on events of this category. Omit for none. */
		roles?: string[];
	}

	/**
	 * Everything a single user action changed, so it can be persisted in one go. Editing or deleting
	 * one occurrence of a repeating event can touch two events (e.g. the original gets an exception
	 * and a new one-off event is created). Events need an `id` to be reported here.
	 */
	export interface CalendarChanges {
		created: CalendarEvent[];
		updated: CalendarEvent[];
		/** ids of removed events */
		deleted: string[];
	}

	export type CalendarView = 'day' | 'week' | 'month';
	export type CalendarMode = 'full' | 'volunteers' | 'readonly';
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import {
		Alert,
		Button,
		ButtonGroup,
		Checkbox,
		Input,
		Label,
		Modal,
		MultiSelect,
		Radio,
		Select
	} from 'flowbite-svelte';

	interface Props {
		events?: CalendarEvent[];
		categories?: CalendarCategory[];
		/** Volunteers that can be added to events. */
		volunteers?: Volunteer[];
		/**
		 * 'full' (default): add, edit and delete events.
		 * 'volunteers': events can't be added or deleted; only their volunteers and roles can be changed.
		 * 'readonly': view only.
		 */
		mode?: CalendarMode;
		/**
		 * Names of categories currently hidden. Users toggle these from the legend; bind to it
		 * if you want to persist or preset the filter.
		 */
		hiddenCategories?: string[];
		view?: CalendarView;
		date?: Date;
		weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
		locale?: string;
		maxPerCell?: number;
		/** Called after an event is added. `changes` lists everything that changed. */
		onadd?: (event: CalendarEvent, changes: CalendarChanges) => void;
		/** Called after an edit; `event` is the changed or newly created event. */
		onedit?: (event: CalendarEvent, scope: RepeatScope, changes: CalendarChanges) => void;
		ondelete?: (event: CalendarEvent, scope: RepeatScope, changes: CalendarChanges) => void;
	}

	type RepeatScope = 'this' | 'following' | 'all';

	let {
		events = $bindable([]),
		categories = [],
		volunteers = [],
		mode = 'full',
		hiddenCategories = $bindable([]),
		view = $bindable('month'),
		date = $bindable(new Date()),
		weekStartsOn = 0,
		locale = undefined,
		maxPerCell = 3,
		onadd,
		onedit,
		ondelete
	}: Props = $props();

	interface Occurrence {
		event: CalendarEvent;
		start: Date;
		end: Date;
		key: string;
		/** 0-based index within a repeating series. */
		n: number;
	}

	/* ---------- constants ---------- */
	const HOUR_H = 48; // px per hour in day/week views
	const SLOT_MIN = 30; // selection granularity
	const SLOT_H = (HOUR_H * SLOT_MIN) / 60;
	const SLOTS = (24 * 60) / SLOT_MIN;
	const MIN_MS = 60_000;
	const DAY_MS = 24 * 60 * MIN_MS;
	const hours = Array.from({ length: 24 }, (_, i) => i);
	const FALLBACK_COLOR = '#6b7280';

	/* ---------- date helpers ---------- */
	const pad = (n: number) => String(n).padStart(2, '0');
	const toDate = (v: Date | string) => (v instanceof Date ? v : new Date(v));
	const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const addDays = (d: Date, n: number) =>
		new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
	const startOfWeek = (d: Date) =>
		addDays(startOfDay(d), -((d.getDay() - weekStartsOn + 7) % 7));
	const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
	const sameDay = (a: Date, b: Date) => key(a) === key(b);
	const at = (d: Date, h: number, m = 0) =>
		new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
	const toInputDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const toInputTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	const parseLocal = (dateStr: string, timeStr: string) => {
		const [y, m, d] = dateStr.split('-').map(Number);
		const [hh, mm] = timeStr.split(':').map(Number);
		return new Date(y, m - 1, d, hh, mm);
	};
	const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

	const fmtDate = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, o);
	const fmtTime = (d: Date) =>
		d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
	const minLabel = (min: number) => fmtTime(new Date(2000, 0, 1, 0, min));
	const hourLabel = (h: number) =>
		new Date(2000, 0, 1, h).toLocaleTimeString(locale, { hour: 'numeric' });

	/* ---------- state ---------- */
	let now = $state(new Date());
	$effect(() => {
		const t = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(t);
	});

	let scroller = $state<HTMLElement>();
	$effect(() => {
		// Scroll the time grid to 7am whenever it first appears.
		if (scroller) scroller.scrollTop = 7 * HOUR_H;
	});

	/* ---------- derived calendar data ---------- */
	const days = $derived.by(() => {
		if (view === 'day') return [startOfDay(date)];
		if (view === 'week') {
			const s = startOfWeek(date);
			return Array.from({ length: 7 }, (_, i) => addDays(s, i));
		}
		const first = new Date(date.getFullYear(), date.getMonth(), 1);
		const offset = (first.getDay() - weekStartsOn + 7) % 7;
		const weeks = Math.ceil((offset + daysInMonth(date.getFullYear(), date.getMonth())) / 7);
		const s = startOfWeek(first);
		return Array.from({ length: weeks * 7 }, (_, i) => addDays(s, i));
	});

	/** 'YYYY-MM-DD' for a Date, or for a date-only string as given (avoids UTC shifting). */
	const dateKey = (v: Date | string) =>
		typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : toInputDate(toDate(v));
	const stepDays = (ev: CalendarEvent) =>
		Math.max(1, Math.floor(ev.repeatEvery ?? 1)) * (ev.repeatUnit === 'day' ? 1 : 7);

	function repeatText(ev: CalendarEvent) {
		const n = Math.max(1, Math.floor(ev.repeatEvery ?? 1));
		const unit = ev.repeatUnit === 'day' ? 'day' : 'week';
		let t = n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
		if (ev.repeatUntil) {
			const [y, m, d] = dateKey(ev.repeatUntil).split('-').map(Number);
			t += ` until ${fmtDate(new Date(y, m - 1, d), { month: 'short', day: 'numeric', year: 'numeric' })}`;
		}
		return t;
	}

	function expand(list: CalendarEvent[], from: Date, to: Date, known: Set<string>): Occurrence[] {
		const out: Occurrence[] = [];
		list.forEach((ev, i) => {
			if (!known.has(ev.category)) return; // category not in the list: don't display
			const s0 = toDate(ev.start);
			const e0 = toDate(ev.end);
			if (isNaN(+s0) || isNaN(+e0)) return;
			const id = ev.id ?? String(i);
			if (!ev.repeating) {
				if (s0 < to && e0 > from) out.push({ event: ev, start: s0, end: e0, key: id, n: 0 });
				return;
			}
			const step = stepDays(ev);
			const until = ev.repeatUntil ? dateKey(ev.repeatUntil) : null;
			const skip = new Set(ev.exceptions ?? []);
			const dur = +e0 - +s0;
			let n = Math.max(0, Math.floor((+from - +e0) / (step * DAY_MS)) - 1);
			for (; ; n++) {
				const s = addDays(s0, step * n);
				if (s >= to) break;
				if (until && toInputDate(s) > until) break;
				if (skip.has(toInputDate(s))) continue;
				const e = new Date(+s + dur);
				if (e > from) out.push({ event: ev, start: s, end: e, key: `${id}:${n}`, n });
			}
		});
		return out;
	}

	// Only events whose category is defined AND currently switched on are displayed.
	const shownCategories = $derived(
		new Set(categories.filter((c) => !hiddenCategories.includes(c.name)).map((c) => c.name))
	);
	const occs = $derived(expand(events, days[0], addDays(days[days.length - 1], 1), shownCategories));

	const toggleCategory = (name: string) =>
		(hiddenCategories = hiddenCategories.includes(name)
			? hiddenCategories.filter((n) => n !== name)
			: [...hiddenCategories, name]);
	const showCategory = (name: string) => {
		if (hiddenCategories.includes(name)) hiddenCategories = hiddenCategories.filter((n) => n !== name);
	};

	/* ---------- what the current mode allows ---------- */
	const canAdd = $derived(mode === 'full' && categories.length > 0);
	const canDelete = $derived(mode === 'full');
	const canEdit = $derived(mode === 'full' || (mode === 'volunteers' && volunteers.length > 0));

	const byDay = $derived.by(() => {
		const m = new Map<string, Occurrence[]>();
		for (const d of days) {
			const de = addDays(d, 1);
			m.set(
				key(d),
				occs
					.filter((o) => o.start < de && o.end > d)
					.sort((a, b) => +a.start - +b.start || +b.end - +a.end)
			);
		}
		return m;
	});

	interface LaidOut {
		o: Occurrence;
		s: number;
		e: number;
		lane: number;
		lanes: number;
	}

	/** Positions a day's events in minutes and splits overlapping ones into lanes. */
	function layoutDay(d: Date): LaidOut[] {
		const ds = +d;
		const de = +addDays(d, 1);
		const items: LaidOut[] = (byDay.get(key(d)) ?? []).map((o) => ({
			o,
			s: (Math.max(+o.start, ds) - ds) / MIN_MS,
			e: (Math.min(+o.end, de) - ds) / MIN_MS,
			lane: 0,
			lanes: 1
		}));
		const out: LaidOut[] = [];
		let cluster: LaidOut[] = [];
		let clusterEnd = -1;
		const flush = () => {
			const laneEnds: number[] = [];
			for (const it of cluster) {
				let l = laneEnds.findIndex((x) => x <= it.s);
				if (l < 0) {
					l = laneEnds.length;
					laneEnds.push(it.e);
				} else laneEnds[l] = it.e;
				it.lane = l;
			}
			for (const it of cluster) it.lanes = laneEnds.length;
			out.push(...cluster);
			cluster = [];
		};
		for (const it of items) {
			if (cluster.length && it.s >= clusterEnd) {
				flush();
				clusterEnd = -1;
			}
			cluster.push(it);
			clusterEnd = Math.max(clusterEnd, it.e);
		}
		if (cluster.length) flush();
		return out;
	}

	const colorOf = (name: string) =>
		categories.find((c) => c.name === name)?.color ?? FALLBACK_COLOR;
	const label = (ev: CalendarEvent) =>
		ev.title;

	/* ---------- header / navigation ---------- */
	const monthItems = $derived(
		Array.from({ length: 12 }, (_, i) => ({
			name: new Date(2000, i, 1).toLocaleDateString(locale, { month: 'long' }),
			value: i
		}))
	);
	const yearItems = $derived.by(() => {
		const y = date.getFullYear();
		return Array.from({ length: 21 }, (_, i) => ({ name: String(y - 10 + i), value: y - 10 + i }));
	});
	const categoryItems = $derived(categories.map((c) => ({ name: c.name, value: c.name })));
	// Shown as "First Last", sorted by last then first name.
	const volunteerItems = $derived(
		[...volunteers]
			.sort(
				(a, b) =>
					a.lastName.localeCompare(b.lastName, locale) || a.firstName.localeCompare(b.firstName, locale)
			)
			.map((v) => ({ name: `${v.firstName} ${v.lastName}`.trim(), value: v.id }))
	);
	const volunteerName = (id: string) => volunteerItems.find((v) => v.value === id)?.name ?? id;
	const volsOf = (ev?: CalendarEvent): EventVolunteer[] =>
		(ev?.volunteers ?? []).map((v) => (typeof v === 'string' ? { id: v } : v));
	const rolesFor = (category: string) => categories.find((c) => c.name === category)?.roles ?? [];
	const volunteerLabel = (v: EventVolunteer) =>
		v.role ? `${volunteerName(v.id)} (${v.role})` : volunteerName(v.id);
	const weekdayNames = $derived(days.slice(0, 7).map((d) => fmtDate(d, { weekday: 'short' })));
	const rangeLabel = $derived.by(() => {
		if (view === 'day')
			return fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
		if (view === 'week')
			return `${fmtDate(days[0], { month: 'short', day: 'numeric' })} – ${fmtDate(days[6], {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			})}`;
		return fmtDate(date, { month: 'long', year: 'numeric' });
	});

	function shift(dir: 1 | -1) {
		if (view === 'month') jump(date.getFullYear(), date.getMonth() + dir);
		else date = addDays(date, (view === 'week' ? 7 : 1) * dir);
	}

	/** Jump to a year/month, keeping the day of month where possible. */
	function jump(year: number, month: number) {
		const first = new Date(year, month, 1);
		const y = first.getFullYear();
		const m = first.getMonth();
		date = new Date(y, m, Math.min(date.getDate(), daysInMonth(y, m)));
	}

	function goDay(d: Date) {
		date = d;
		view = 'day';
	}

	/* ---------- drag-to-select (day & week views) ---------- */
	let sel = $state<{ day: Date; a: number; b: number } | null>(null);

	interface Drag {
		id: number;
		el: HTMLElement;
		day: Date;
		touch: boolean;
		active: boolean;
		x0: number;
		y0: number;
		lastY: number;
		timer?: ReturnType<typeof setTimeout>;
	}
	let drag: Drag | null = null;

	const slotAt = (el: HTMLElement, clientY: number) =>
		Math.min(SLOTS - 1, Math.max(0, Math.floor((clientY - el.getBoundingClientRect().top) / SLOT_H)));

	function begin(slot: number) {
		if (!drag) return;
		drag.active = true;
		sel = { day: drag.day, a: slot, b: slot };
		try {
			drag.el.setPointerCapture(drag.id);
		} catch {
			/* pointer already gone */
		}
		if (drag.touch) navigator.vibrate?.(15);
	}

	function cancelDrag() {
		if (drag?.timer) clearTimeout(drag.timer);
		drag = null;
		sel = null;
	}

	function onDown(e: PointerEvent, day: Date) {
		if (!canAdd) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		const el = e.currentTarget as HTMLElement;
		const touch = e.pointerType !== 'mouse';
		const d: Drag = {
			id: e.pointerId,
			el,
			day,
			touch,
			active: false,
			x0: e.clientX,
			y0: e.clientY,
			lastY: e.clientY
		};
		drag = d;
		if (touch) {
			// Touch: press and hold to start selecting, so normal scrolling still works.
			d.timer = setTimeout(() => begin(slotAt(el, d.lastY)), 300);
		} else {
			e.preventDefault();
			begin(slotAt(el, e.clientY));
		}
	}

	function onMove(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		drag.lastY = e.clientY;
		if (!drag.active) {
			if (drag.touch && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10) cancelDrag();
			return;
		}
		if (sel) sel = { ...sel, b: slotAt(drag.el, e.clientY) };
	}

	function onUp(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		const s = sel;
		const wasActive = drag.active;
		cancelDrag();
		if (wasActive && s) {
			const lo = Math.min(s.a, s.b);
			const hi = Math.max(s.a, s.b) + 1;
			openForm(at(s.day, 0, lo * SLOT_MIN), at(s.day, 0, hi * SLOT_MIN));
		}
	}

	/** Stop the page scrolling while a touch selection is in progress. */
	function blockScroll(node: HTMLElement) {
		const h = (e: TouchEvent) => {
			if (drag?.active && e.cancelable) e.preventDefault();
		};
		node.addEventListener('touchmove', h, { passive: false });
		return { destroy: () => node.removeEventListener('touchmove', h) };
	}

	const selRange = $derived(
		sel
			? {
					top: Math.min(sel.a, sel.b) * SLOT_H,
					height: (Math.abs(sel.b - sel.a) + 1) * SLOT_H,
					text: `${minLabel(Math.min(sel.a, sel.b) * SLOT_MIN)} – ${minLabel(
						(Math.max(sel.a, sel.b) + 1) * SLOT_MIN
					)}`
				}
			: null
	);

	/* ---------- add form ---------- */
	interface Draft {
		title: string;
		location: string;
		day: string;
		startT: string;
		endT: string;
		category: string;
		repeating: boolean;
		every: string | number;
		unit: 'day' | 'week';
		/** 'YYYY-MM-DD', or '' to repeat with no end date. */
		until: string;
		volunteers: string[];
		/** Role per volunteer id (missing or '' = no role). */
		roles: Record<string, string>;
		/** Which occurrences an edit applies to (only used when editing a repeating event). */
		scope: RepeatScope;
	}
	let draft = $state<Draft | null>(null);
	let editing = $state<Occurrence | null>(null);
	let formError = $state('');
	let formOpen = $state(false);
	let titleInput = $state<HTMLInputElement>();

	// Flowbite gives checkboxes/radios a light-gray fill that hides the (white) check mark when
	// checked; give the checked state an explicit blue fill, in both themes.
	const checkedStyle =
		'checked:border-blue-600 checked:bg-blue-600 dark:checked:border-blue-500 dark:checked:bg-blue-500';

	const unitItems = [
		{ name: 'day(s)', value: 'day' },
		{ name: 'week(s)', value: 'week' }
	];
	const scopeItems: { value: RepeatScope; label: string }[] = [
		{ value: 'this', label: 'This event only' },
		{ value: 'following', label: 'This and all following events' },
		{ value: 'all', label: 'All events in the series' }
	];

	/** Replace `events` with `next` and report what differs, matching events by id. */
	function commit(next: CalendarEvent[]): CalendarChanges {
		const prev = new Map<string, CalendarEvent>();
		for (const e of events) if (e.id != null) prev.set(e.id, e);
		const seen = new Set<string>();
		const created: CalendarEvent[] = [];
		const updated: CalendarEvent[] = [];
		for (const e of next) {
			if (e.id == null) continue;
			seen.add(e.id);
			const old = prev.get(e.id);
			if (!old) created.push(e);
			else if (old !== e) updated.push(e);
		}
		const deleted = [...prev.keys()].filter((id) => !seen.has(id));
		events = next;
		return { created, updated, deleted };
	}

	const sameEvent = (a: CalendarEvent, b: CalendarEvent) => (b.id != null ? a.id === b.id : a === b);
	const newId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

	async function openForm(start: Date, end: Date, occ: Occurrence | null = null) {
		if (occ ? !canEdit : !canAdd) return;
		const endsAtMidnight = end.getHours() === 0 && end.getMinutes() === 0;
		const ev = occ?.event;
		editing = occ;
		draft = {
			title: ev?.title ?? '',
			location: ev?.location ?? '',
			day: toInputDate(start),
			startT: toInputTime(start),
			endT: endsAtMidnight ? '23:59' : toInputTime(end),
			// New events default to the first category that is currently shown.
			category: ev?.category ?? (categories.find((c) => shownCategories.has(c.name)) ?? categories[0])?.name ?? '',
			repeating: ev?.repeating ?? false,
			every: ev?.repeatEvery ?? 1,
			unit: ev?.repeatUnit === 'day' ? 'day' : 'week',
			until: ev?.repeatUntil ? dateKey(ev.repeatUntil) : '',
			volunteers: volsOf(ev).map((v) => v.id),
			roles: Object.fromEntries(volsOf(ev).flatMap((v) => (v.role ? [[v.id, v.role]] : []))),
			scope: 'this'
		};
		formError = '';
		formOpen = true;
		await tick();
		titleInput?.focus();
	}

	function setRole(id: string, role: string) {
		if (draft) draft.roles = { ...draft.roles, [id]: role };
	}

	/** Drop roles that the (newly chosen) category doesn't offer. */
	function pruneRoles() {
		if (!draft) return;
		const allowed = rolesFor(draft.category);
		draft.roles = Object.fromEntries(Object.entries(draft.roles).filter(([, r]) => allowed.includes(r)));
	}

	function editViewing() {
		if (!viewing) return;
		const o = viewing;
		detailOpen = false;
		// Show the occurrence the user clicked, clipped to one day for the form.
		const end = sameDay(o.start, o.end) ? o.end : at(o.start, 23, 59);
		openForm(o.start, end, o);
	}

	function addDefault() {
		if (!canAdd) return;
		const today = sameDay(date, now);
		const h = today ? Math.min(now.getHours() + 1, 22) : 9;
		openForm(at(date, h), at(date, h + 1));
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!draft) return;
		if (mode === 'volunteers') return submitVolunteers();
		if (mode !== 'full') return;
		const title = draft.title.trim();
		if (!title) {
			formError = 'Please enter a title.';
			return;
		}
		const start = parseLocal(draft.day, draft.startT);
		const end = parseLocal(draft.day, draft.endT);
		if (isNaN(+start) || isNaN(+end)) {
			formError = 'Please enter a valid date and times.';
			return;
		}
		if (end <= start) {
			formError = 'The end time must be after the start time.';
			return;
		}
		const every = Math.max(1, Math.floor(Number(draft.every)) || 1);
		if (draft.repeating && draft.until && draft.until < draft.day) {
			formError = 'The repeat end date must be on or after the event date.';
			return;
		}

		const orig = editing;
		const scope: RepeatScope = orig?.event.repeating ? draft.scope : 'all';
		const repeats = draft.repeating && scope !== 'this';
		// Make sure the saved event doesn't vanish because its category is switched off.
		showCategory(draft.category);
		const details = {
			title,
			location: draft.location.trim(),
			category: draft.category,
			volunteers: draft.volunteers.map((id): EventVolunteer => {
				const role = draft!.roles[id];
				return role && rolesFor(draft!.category).includes(role) ? { id, role } : { id };
			})
		};
		const repeatFields: Partial<CalendarEvent> = repeats
			? {
					repeating: true,
					repeatEvery: every,
					repeatUnit: draft.unit,
					repeatUntil: draft.until || undefined
				}
			: { repeating: false, repeatEvery: undefined, repeatUnit: undefined, repeatUntil: undefined };

		let result: CalendarEvent;
		let next: CalendarEvent[];

		if (!orig) {
			// New event
			result = { id: newId(), ...details, start, end, ...repeatFields };
			const changes = commit([...events, result]);
			onadd?.(result, changes);
			formOpen = false;
			return;
		}

		const base = orig.event;
		const isFirst = orig.n === 0;

		if (scope === 'this') {
			// Detach this occurrence into its own one-off event.
			result = { id: newId(), ...details, start, end, repeating: false };
			next = [
				...events.map((x) =>
					sameEvent(x, base) ? { ...x, exceptions: [...(x.exceptions ?? []), toInputDate(orig.start)] } : x
				),
				result
			];
		} else if (scope === 'following' && !isFirst) {
			// End the old series the day before, start a new series from this occurrence.
			const cutoff = toInputDate(orig.start);
			result = {
				id: newId(),
				...details,
				start,
				end,
				...repeatFields,
				exceptions: (base.exceptions ?? []).filter((d) => d >= cutoff)
			};
			next = [
				...events.map((x) =>
					sameEvent(x, base)
						? {
								...x,
								repeatUntil: toInputDate(addDays(startOfDay(orig.start), -1)),
								exceptions: (x.exceptions ?? []).filter((d) => d < cutoff)
							}
						: x
				),
				result
			];
		} else {
			// Whole series (or a one-off event): move the base event by the same day shift.
			const dayShift = Math.round((+startOfDay(start) - +startOfDay(orig.start)) / DAY_MS);
			const baseDay = addDays(startOfDay(toDate(base.start)), dayShift);
			const newStart = at(baseDay, start.getHours(), start.getMinutes());
			const newEnd = at(baseDay, end.getHours(), end.getMinutes());
			result = {
				...base,
				...details,
				start: base.repeating ? newStart : start,
				end: base.repeating ? newEnd : end,
				...repeatFields,
				exceptions: repeats ? base.exceptions : undefined
			};
			next = events.map((x) => (sameEvent(x, base) ? result : x));
		}
		const changes = commit(next);
		onedit?.(result, scope, changes);
		formOpen = false;
	}

	/** 'volunteers' mode: change only the volunteers and roles, leaving everything else untouched. */
	function submitVolunteers() {
		const orig = editing;
		if (!draft || !orig || !canEdit) return;
		const base = orig.event;
		const allowed = rolesFor(base.category);
		const vols = draft.volunteers.map((id): EventVolunteer => {
			const role = draft!.roles[id];
			return role && allowed.includes(role) ? { id, role } : { id };
		});
		const scope: RepeatScope = base.repeating ? draft.scope : 'all';
		let result: CalendarEvent;
		let next: CalendarEvent[];

		if (scope === 'this') {
			// Split this occurrence off as its own event with the new volunteers.
			result = {
				...base,
				id: newId(),
				start: orig.start,
				end: orig.end,
				volunteers: vols,
				repeating: false,
				repeatEvery: undefined,
				repeatUnit: undefined,
				repeatUntil: undefined,
				exceptions: undefined
			};
			next = [
				...events.map((x) =>
					sameEvent(x, base) ? { ...x, exceptions: [...(x.exceptions ?? []), toInputDate(orig.start)] } : x
				),
				result
			];
		} else if (scope === 'following' && orig.n > 0) {
			const cutoff = toInputDate(orig.start);
			result = {
				...base,
				id: newId(),
				start: orig.start,
				end: orig.end,
				volunteers: vols,
				exceptions: (base.exceptions ?? []).filter((d) => d >= cutoff)
			};
			next = [
				...events.map((x) =>
					sameEvent(x, base)
						? {
								...x,
								repeatUntil: toInputDate(addDays(startOfDay(orig.start), -1)),
								exceptions: (x.exceptions ?? []).filter((d) => d < cutoff)
							}
						: x
				),
				result
			];
		} else {
			result = { ...base, volunteers: vols };
			next = events.map((x) => (sameEvent(x, base) ? result : x));
		}
		const changes = commit(next);
		onedit?.(result, scope, changes);
		formOpen = false;
	}

	/* ---------- details / delete ---------- */
	let viewing = $state<Occurrence | null>(null);
	let confirming = $state(false);
	let detailOpen = $state(false);

	let deleteScope = $state<RepeatScope>('this');

	function openDetail(o: Occurrence) {
		viewing = o;
		confirming = false;
		deleteScope = 'this';
		detailOpen = true;
	}

	function doDelete() {
		if (!viewing || !canDelete) return;
		const { event: ev, start, n } = viewing;
		const scope: RepeatScope = ev.repeating ? deleteScope : 'all';
		let next: CalendarEvent[];

		if (scope === 'all' || (scope === 'following' && n === 0)) {
			next = events.filter((x) => !sameEvent(x, ev));
		} else if (scope === 'this') {
			next = events.map((x) =>
				sameEvent(x, ev) ? { ...x, exceptions: [...(x.exceptions ?? []), toInputDate(start)] } : x
			);
		} else {
			const cutoff = toInputDate(start);
			next = events.map((x) =>
				sameEvent(x, ev)
					? {
							...x,
							repeatUntil: toInputDate(addDays(startOfDay(start), -1)),
							exceptions: (x.exceptions ?? []).filter((d) => d < cutoff)
						}
					: x
			);
		}
		const changes = commit(next);
		ondelete?.(ev, scope, changes);
		detailOpen = false;
	}
</script>

{#snippet repeatIcon()}
	<svg class="repeat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
		stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Repeating event">
		<title>Repeating event</title>
		<path d="M17 2l4 4-4 4" />
		<path d="M3 11v-1a4 4 0 0 1 4-4h14" />
		<path d="M7 22l-4-4 4-4" />
		<path d="M21 13v1a4 4 0 0 1-4 4H3" />
	</svg>
{/snippet}

<div class="cal">
	<header class="bar">
		<div class="nav">
			<Button size="sm" color="alternative" aria-label="Previous {view}" onclick={() => shift(-1)}>‹</Button>
			<Button size="sm" color="alternative" onclick={() => (date = new Date())}>Today</Button>
			<Button size="sm" color="alternative" aria-label="Next {view}" onclick={() => shift(1)}>›</Button>
		</div>

		<div class="jump">
			<Select
				size="sm"
				class="w-36"
				aria-label="Month"
				items={monthItems}
				value={date.getMonth()}
				onchange={(e) => jump(date.getFullYear(), Number(e.currentTarget.value))}
			/>
			<Select
				size="sm"
				class="w-24"
				aria-label="Year"
				items={yearItems}
				value={date.getFullYear()}
				onchange={(e) => jump(Number(e.currentTarget.value), date.getMonth())}
			/>
		</div>

		<ButtonGroup class="views" aria-label="Calendar view">
			{#each ['day', 'week', 'month'] as const as v}
				<Button
						size="sm"
						color={view === v ? 'blue' : 'alternative'}
						class={view === v ? 'z-10 border border-blue-700 ring-2 ring-blue-300 dark:border-blue-400 dark:ring-blue-500' : ''}
					aria-pressed={view === v}
					onclick={() => (view = v)}
				>
					{v[0].toUpperCase() + v.slice(1)}
				</Button>
			{/each}
		</ButtonGroup>

		{#if canAdd}
			<Button size="sm" color="blue" onclick={addDefault}>+ Add</Button>
		{/if}
	</header>

	<p class="range" class:sr-only={view === 'month'} aria-live="polite">{rangeLabel}</p>

	{#if categories.length}
		<ul class="legend" aria-label="Categories (toggle to show or hide)">
			{#each categories as c (c.name)}
				{@const on = shownCategories.has(c.name)}
				<li>
					<button
						type="button"
						class="legend-btn"
						class:off={!on}
						style="--c:{c.color}"
						aria-pressed={on}
						title={on ? `Hide ${c.name}` : `Show ${c.name}`}
						onclick={() => toggleCategory(c.name)}
					>
						<span class="dot"></span>{c.name}
					</button>
				</li>
			{/each}
			{#if hiddenCategories.some((n) => categories.some((c) => c.name === n))}
				<li>
					<button type="button" class="legend-btn all" onclick={() => (hiddenCategories = [])}>
						Show all
					</button>
				</li>
			{/if}
			<li class="repeat-key">{@render repeatIcon()} Repeating</li>
		</ul>
	{/if}

	{#if view === 'month'}
		<div class="month">
			<div class="dow">
				{#each weekdayNames as n}<div>{n}</div>{/each}
			</div>
			<div class="weeks">
				{#each days as d (key(d))}
					{@const list = byDay.get(key(d)) ?? []}
					<div class="cell" class:other={d.getMonth() !== date.getMonth()} class:today={sameDay(d, now)}>
						{#if canAdd}
							<button
								type="button"
								class="cell-add"
								aria-label="Add event on {fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}"
								onclick={() => openForm(at(d, 9), at(d, 10))}
							></button>
						{/if}
						<div class="cell-content">
							<button type="button" class="daynum" onclick={() => goDay(d)}>{d.getDate()}</button>
							{#each list.slice(0, maxPerCell) as o (o.key)}
								<button
									type="button"
									class="chip"
									style="--c:{colorOf(o.event.category)}"
									title="{label(o.event)}&#10;{fmtTime(o.start)} – {fmtTime(o.end)}"
									onclick={() => openDetail(o)}
								>
									{#if o.event.repeating}{@render repeatIcon()}{/if}
									<span class="chip-text">{label(o.event)}</span>
								</button>
							{/each}
							{#if list.length > maxPerCell}
								<button type="button" class="more" onclick={() => goDay(d)}>
									+{list.length - maxPerCell} more
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		{#if canAdd}
			<p class="hint">Drag across the grid to pick a time. On touch screens, press and hold, then drag.</p>
		{/if}
		<div class="scroller" bind:this={scroller}>
			<div class="head" style="--cols:{days.length};--minw:{view === 'week' ? '640px' : '0px'}">
				<div class="gutter"></div>
				{#each days as d (key(d))}
					<button
						type="button"
						class="dayhead"
						class:today={sameDay(d, now)}
						disabled={view === 'day'}
						onclick={() => goDay(d)}
					>
						<span class="wd">{fmtDate(d, { weekday: 'short' })}</span>
						<span class="dn">{d.getDate()}</span>
					</button>
				{/each}
			</div>

			<div
				class="body"
				style="--cols:{days.length};--minw:{view === 'week' ? '640px' : '0px'}"
				use:blockScroll
			>
				<div class="gutter">
					{#each hours.slice(1) as h}
						<div class="hlabel" style="top:{h * HOUR_H}px">{hourLabel(h)}</div>
					{/each}
				</div>

				{#each days as d (key(d))}
					{@const items = layoutDay(d)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="col"
						class:today={sameDay(d, now)}
						class:no-add={!canAdd}
						onpointerdown={(e) => onDown(e, d)}
						onpointermove={onMove}
						onpointerup={onUp}
						onpointercancel={cancelDrag}
						oncontextmenu={(e) => drag && e.preventDefault()}
					>
						{#each items as it (it.o.key)}
							<button
								type="button"
								class="evt"
								style="--c:{colorOf(it.o.event.category)};top:{(it.s / 60) * HOUR_H}px;height:{Math.max(
									((it.e - it.s) / 60) * HOUR_H,
									20
								)}px;left:calc({(it.lane / it.lanes) * 100}% + 1px);width:calc({100 / it.lanes}% - 3px)"
								onpointerdown={(e) => e.stopPropagation()}
								onclick={() => openDetail(it.o)}
							>
								<strong>
									{#if it.o.event.repeating}{@render repeatIcon()}{/if}
									<span class="chip-text">{label(it.o.event)}</span>
								</strong>
								<span>{fmtTime(it.o.start)} – {fmtTime(it.o.end)}</span>
								{#if it.o.event.location}<span>{it.o.event.location}</span>{/if}
							</button>
						{/each}

						{#if sel && selRange && sameDay(sel.day, d)}
							<div class="sel" style="top:{selRange.top}px;height:{selRange.height}px">
								<span>{selRange.text}</span>
							</div>
						{/if}

						{#if sameDay(d, now)}
							<div class="now" style="top:{((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_H}px"></div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Add event -->
	<Modal
		bind:open={formOpen}
		title={mode === 'volunteers' ? `Volunteers: ${editing ? editing.event.title : ''}` : editing ? 'Edit event' : 'New event'}
		size="xs"
	>
		{#if draft}
			<form id="cal-event-form" class="space-y-3" onsubmit={submit}>
				{#if editing?.event.repeating}
					<fieldset class="space-y-1 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
						<legend class="px-1 text-sm font-medium text-gray-900 dark:text-white">Apply changes to</legend>
						{#each scopeItems as s}
							<Radio color="blue" class={checkedStyle} name="edit-scope" value={s.value} bind:group={draft.scope}>{s.label}</Radio>
						{/each}
					</fieldset>
				{/if}

				{#if mode === 'full'}
				<Label class="space-y-1">
					<span>Title</span>
					<Input bind:elementRef={titleInput} bind:value={draft.title} required />
				</Label>
				<Label class="space-y-1">
					<span>Location</span>
					<Input bind:value={draft.location} />
				</Label>

				<div class="grid grid-cols-3 gap-2">
					<Label class="col-span-3 space-y-1 sm:col-span-1">
						<span>Date</span>
						<Input type="date" bind:value={draft.day} required />
					</Label>
					<Label class="col-span-3 space-y-1 sm:col-span-1">
						<span>Start</span>
						<Input type="time" bind:value={draft.startT} required />
					</Label>
					<Label class="col-span-3 space-y-1 sm:col-span-1">
						<span>End</span>
						<Input type="time" bind:value={draft.endT} required />
					</Label>
				</div>

				{#if categories.length}
						\1
					{/if}
					{:else if editing}
						<!-- 'volunteers' mode: the event itself is read-only -->
						<dl class="details">
							<dt>Event</dt>
							<dd>{label(editing.event)}</dd>
							<dt>When</dt>
							<dd>
								{fmtDate(editing.start, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })},
								{fmtTime(editing.start)} – {fmtTime(editing.end)}
							</dd>
							{#if editing.event.location}<dt>Where</dt><dd>{editing.event.location}</dd>{/if}
						</dl>
					{/if}

				{#if volunteerItems.length}
					{@const roleList = rolesFor(draft.category)}
					<Label class="space-y-1">
						<span>Volunteers</span>
						<MultiSelect items={volunteerItems} bind:value={draft.volunteers} placeholder="Add volunteers" />
					</Label>

					{#if roleList.length && draft.volunteers.length}
						<div class="space-y-2">
							{#each draft.volunteers as id (id)}
								<div class="grid grid-cols-2 items-center gap-2">
									<span class="truncate text-sm text-gray-900 dark:text-white">{volunteerName(id)}</span>
									<Select
										size="sm"
										aria-label="Role for {volunteerName(id)}"
										items={[{ name: 'No role', value: '' }, ...roleList.map((r) => ({ name: r, value: r }))]}
										value={draft.roles[id] ?? ''}
										onchange={(e) => setRole(id, e.currentTarget.value)}
									/>
								</div>
							{/each}
						</div>
					{/if}
				{/if}

				{#if mode === 'full' && !(editing?.event.repeating && draft.scope === 'this')}
					<Checkbox color="blue" class={checkedStyle} bind:checked={draft.repeating}>Repeating event</Checkbox>

					{#if draft.repeating}
						<div class="grid grid-cols-2 gap-2">
							<Label class="space-y-1">
								<span>Repeat every</span>
								<Input type="number" min="1" step="1" bind:value={draft.every} required />
							</Label>
							<Label class="space-y-1">
								<span>&nbsp;</span>
								<Select items={unitItems} bind:value={draft.unit} />
							</Label>
							<Label class="col-span-2 space-y-1">
								<span>Repeat until <span class="text-gray-400">(leave blank for no end date)</span></span>
								<Input type="date" min={draft.day} bind:value={draft.until} />
							</Label>
						</div>
					{/if}
				{/if}

				{#if formError}<Alert color="red" class="py-2">{formError}</Alert>{/if}
			</form>
		{/if}
		{#snippet footer()}
			<div class="ms-auto flex gap-2">
				<Button color="alternative" onclick={() => (formOpen = false)}>Cancel</Button>
				<Button type="submit" color="blue" form="cal-event-form">{editing ? 'Save changes' : 'Add event'}</Button>
			</div>
		{/snippet}
	</Modal>

	<!-- Event details / delete -->
	<Modal
		bind:open={detailOpen}
		title={viewing ? label(viewing.event) : ''}
		size="xs"
		onclose={() => (confirming = false)}
	>
		{#if viewing}
			{@const ev = viewing.event}
			<div class="space-y-3" style="--c:{colorOf(ev.category)}">
				<p class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
					<span class="dot big"></span>{ev.category}
					{#if ev.repeating}<span class="inline-flex items-center gap-1">· {@render repeatIcon()} {repeatText(ev)}</span>{/if}
				</p>
				<dl class="details">
					<dt>When</dt>
					<dd>
						{#if sameDay(viewing.start, viewing.end)}
							{fmtDate(viewing.start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}<br />
							{fmtTime(viewing.start)} – {fmtTime(viewing.end)}
						{:else}
							{fmtDate(viewing.start, { month: 'short', day: 'numeric' })} {fmtTime(viewing.start)} –
							{fmtDate(viewing.end, { month: 'short', day: 'numeric' })} {fmtTime(viewing.end)}
						{/if}
					</dd>
					{#if ev.location}<dt>Where</dt><dd>{ev.location}</dd>{/if}
					{#if volsOf(ev).length}
						<dt>Volunteers</dt>
						<dd>
							{#each volsOf(ev) as v}<div>{volunteerLabel(v)}</div>{/each}
						</dd>
					{/if}
				</dl>
				{#if confirming}
					{#if ev.repeating}
						<fieldset class="space-y-1 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
							<legend class="px-1 text-sm font-medium text-gray-900 dark:text-white">Delete which events?</legend>
							{#each scopeItems as s}
								<Radio color="blue" class={checkedStyle} name="delete-scope" value={s.value} bind:group={deleteScope}>{s.label}</Radio>
							{/each}
						</fieldset>
					{:else}
						<Alert color="red" class="py-2">Delete this event?</Alert>
					{/if}
				{/if}
			</div>
		{/if}
		{#snippet footer()}
			<div class="ms-auto flex gap-2">
				{#if confirming}
					<Button color="alternative" onclick={() => (confirming = false)}>Keep</Button>
					<Button color="red" onclick={doDelete}>Delete</Button>
				{:else}
					<Button color="alternative" onclick={() => (detailOpen = false)}>Close</Button>
					{#if canEdit}
						<Button color="alternative" onclick={editViewing}>
							{mode === 'volunteers' ? 'Edit volunteers' : 'Edit'}
						</Button>
					{/if}
					{#if canDelete}
						<Button color="red" outline onclick={() => (confirming = true)}>Delete</Button>
					{/if}
				{/if}
			</div>
		{/snippet}
	</Modal>
</div>

<style>
	.cal {
		--cal-bg: #ffffff;
		--cal-fg: #1f2937;
		--cal-muted: #6b7280;
		--cal-line: #e5e7eb;
		--cal-line-soft: #f1f5f9;
		--cal-surface: #f8fafc;
		--cal-accent: #2563eb;
		--cal-accent-fg: #ffffff;
		--cal-today: #eff6ff;
		--gutter-w: 52px;

		color: var(--cal-fg);
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	/* Tailwind class-based dark mode (<html class="dark">) */
	:global(.dark) .cal {
		--cal-bg: #111827;
		--cal-fg: #e5e7eb;
		--cal-muted: #9ca3af;
		--cal-line: #374151;
		--cal-line-soft: #1f2937;
		--cal-surface: #1f2937;
		--cal-accent: #3b82f6;
		--cal-today: #1e3a5f;
	}

	/* Raw buttons used inside the grid (flowbite supplies the other controls) */
	.cell-add,
	.daynum,
	.chip,
	.more,
	.dayhead,
	.evt {
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;
		padding: 0;
	}
	.cell-add:focus-visible,
	.daynum:focus-visible,
	.chip:focus-visible,
	.more:focus-visible,
	.dayhead:focus-visible,
	.evt:focus-visible {
		outline: 2px solid var(--cal-accent);
		outline-offset: -2px;
	}

	/* header */
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.nav,
	.jump {
		display: flex;
		gap: 4px;
	}
	.bar :global(.views) {
		margin-left: auto;
	}

	.range {
		margin: 0;
		font-weight: 600;
		font-size: 16px;
	}
	.hint {
		margin: 0;
		color: var(--cal-muted);
		font-size: 12px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 12px;
		color: var(--cal-muted);
	}
	.legend li {
		display: inline-flex;
		align-items: center;
	}
	.legend-btn {
		display: inline-flex;
		align-items: center;
		font: inherit;
		color: var(--cal-fg);
		background: none;
		border: 1px solid var(--cal-line);
		border-radius: 999px;
		padding: 2px 10px 2px 8px;
		cursor: pointer;
	}
	.legend-btn:hover {
		background: var(--cal-surface);
	}
	.legend-btn:focus-visible {
		outline: 2px solid var(--cal-accent);
		outline-offset: 1px;
	}
	.legend-btn.off {
		color: var(--cal-muted);
		text-decoration: line-through;
	}
	.legend-btn.off .dot {
		background: transparent;
		border: 2px solid var(--c);
	}
	.legend-btn.all {
		padding-left: 10px;
		color: var(--cal-accent);
		border-style: dashed;
	}
	.legend .repeat-key {
		margin-left: 4px;
	}
	.dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-right: 6px;
		background: var(--c);
		box-sizing: border-box;
	}
	.dot.big {
		background: var(--c);
		width: 12px;
		height: 12px;
	}

	.repeat-icon {
		width: 0.95em;
		height: 0.95em;
		flex: none;
		margin-right: 3px;
		opacity: 0.8;
	}

	/* month view */
	.month {
		border: 1px solid var(--cal-line);
		border-radius: 10px;
		overflow: hidden;
		background: var(--cal-bg);
	}
	.dow {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		background: var(--cal-surface);
		border-bottom: 1px solid var(--cal-line);
		text-align: center;
		font-size: 12px;
		color: var(--cal-muted);
		padding: 6px 0;
	}
	.weeks {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		grid-auto-rows: minmax(92px, auto);
	}
	.cell {
		position: relative;
		border-right: 1px solid var(--cal-line-soft);
		border-bottom: 1px solid var(--cal-line-soft);
		min-width: 0;
	}
	.cell:nth-child(7n) {
		border-right: 0;
	}
	.cell.other {
		background: var(--cal-surface);
	}
	.cell.other .daynum {
		color: var(--cal-muted);
	}
	.cell.today {
		background: var(--cal-today);
	}
	.cell-add {
		position: absolute;
		inset: 0;
		width: 100%;
	}
	.cell-add:hover {
		background: color-mix(in srgb, var(--cal-accent) 6%, transparent);
	}
	.cell-content {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 3px;
		pointer-events: none;
		min-height: 100%;
	}
	.cell-content > * {
		pointer-events: auto;
	}
	.daynum {
		align-self: flex-start;
		padding: 1px 6px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 600;
	}
	.cell.today .daynum {
		background: var(--cal-accent);
		color: var(--cal-accent-fg);
	}

	.chip,
	.evt {
		background: color-mix(in srgb, var(--c) 20%, var(--cal-bg));
		border-left: 3px solid var(--c);
		text-align: left;
	}
	.chip {
		display: flex;
		align-items: center;
		border-radius: 4px;
		padding: 1px 5px;
		font-size: 11px;
		width: 100%;
		min-width: 0;
	}
	.chip-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.chip:hover,
	.evt:hover {
		background: color-mix(in srgb, var(--c) 32%, var(--cal-bg));
	}
	.more {
		color: var(--cal-muted);
		font-size: 11px;
		padding: 0 5px;
		text-align: left;
	}

	/* day / week view */
	.scroller {
		position: relative;
		max-height: 70vh;
		overflow: auto;
		border: 1px solid var(--cal-line);
		border-radius: 10px;
		overscroll-behavior: contain;
		background: var(--cal-bg);
	}
	.head,
	.body {
		display: grid;
		grid-template-columns: var(--gutter-w) repeat(var(--cols), minmax(0, 1fr));
		min-width: var(--minw);
	}
	.head {
		position: sticky;
		top: 0;
		z-index: 5;
		background: var(--cal-surface);
		border-bottom: 1px solid var(--cal-line);
	}
	.dayhead {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 6px 0;
		color: var(--cal-muted);
	}
	.dayhead:disabled {
		cursor: default;
	}
	.dayhead .dn {
		font-size: 18px;
		font-weight: 600;
		color: var(--cal-fg);
		min-width: 32px;
		border-radius: 999px;
	}
	.dayhead.today .dn {
		background: var(--cal-accent);
		color: var(--cal-accent-fg);
	}
	.wd {
		font-size: 12px;
	}

	.gutter {
		position: relative;
	}
	.body .gutter {
		height: calc(24px * 2 * 24);
	}
	.hlabel {
		position: absolute;
		right: 6px;
		transform: translateY(-50%);
		font-size: 11px;
		color: var(--cal-muted);
		white-space: nowrap;
	}

	.col {
		position: relative;
		height: calc(24px * 2 * 24);
		border-left: 1px solid var(--cal-line);
		background-image:
			repeating-linear-gradient(
				to bottom,
				var(--cal-line) 0,
				var(--cal-line) 1px,
				transparent 1px,
				transparent 48px
			),
			repeating-linear-gradient(
				to bottom,
				transparent 0,
				transparent 24px,
				var(--cal-line-soft) 24px,
				var(--cal-line-soft) 25px,
				transparent 25px,
				transparent 48px
			);
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		cursor: crosshair;
	}
	.col.today {
		background-color: var(--cal-today);
	}
	.col.no-add {
		cursor: default;
	}

	.evt {
		position: absolute;
		z-index: 2;
		border-radius: 5px;
		padding: 2px 5px;
		font-size: 12px;
		line-height: 1.25;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		touch-action: pan-y;
	}
	.evt strong {
		display: flex;
		align-items: center;
		font-weight: 600;
		min-width: 0;
	}
	.evt > span {
		color: var(--cal-muted);
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sel {
		position: absolute;
		left: 2px;
		right: 2px;
		z-index: 3;
		pointer-events: none;
		background: color-mix(in srgb, var(--cal-accent) 25%, transparent);
		border: 1px solid var(--cal-accent);
		border-radius: 5px;
		font-size: 11px;
		padding: 1px 5px;
		overflow: hidden;
	}
	.now {
		position: absolute;
		left: 0;
		right: 0;
		height: 0;
		border-top: 2px solid #ef4444;
		z-index: 4;
		pointer-events: none;
	}
	.now::before {
		content: '';
		position: absolute;
		left: -4px;
		top: -5px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ef4444;
	}

	/* details dialog */
	.details {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 12px;
		margin: 0;
		font-size: 14px;
	}
	.details dt {
		color: var(--cal-muted);
	}
	.details dd {
		margin: 0;
	}

	@media (max-width: 560px) {
		.bar :global(.views) {
			margin-left: 0;
		}
	}
</style>