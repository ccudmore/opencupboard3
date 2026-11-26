import prisma from "#lib/prisma.ts";
import { TIMEZONE } from "$app/env/private";
import { countPeople } from "#lib/householdSize.ts";
import {
  ExpenseStatus,
  AppointmentBookingStatus,
  HouseholdStatus,
} from "#prisma/enums";

// ---------------------------------------------------------------- months in the local time zone

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function offsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return (
    Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) -
    utcMs
  );
}

/** Midnight at the start of a month (month0 = 0 for January) in the configured time zone. */
function startOfMonth(year: number, month0: number): Date {
  const guess = Date.UTC(year, month0, 1);
  const first = guess - offsetMs(guess);
  const second = guess - offsetMs(first);
  return new Date(second);
}

export type Month = { key: string; label: string; start: Date; end: Date };

/** The last `count` months up to and including the current one, oldest first. */
export function lastMonths(count: number, now = new Date()): Month[] {
  const local = new Date(now.getTime() + offsetMs(now.getTime()));
  let year = local.getUTCFullYear();
  let month0 = local.getUTCMonth();
  const months: Month[] = [];
  for (let i = 0; i < count; i++) {
    const nextYear = month0 === 11 ? year + 1 : year;
    const nextMonth0 = (month0 + 1) % 12;
    months.unshift({
      key: `${year}-${String(month0 + 1).padStart(2, "0")}`,
      label: `${MONTH_NAMES[month0]} ${year}`,
      start: startOfMonth(year, month0),
      end: startOfMonth(nextYear, nextMonth0),
    });
    year = month0 === 0 ? year - 1 : year;
    month0 = (month0 + 11) % 12;
  }
  return months;
}

export const MONTH_CHOICES = [6, 12, 24, 36];
export const parseMonths = (raw: string | null) =>
  MONTH_CHOICES.includes(Number(raw)) ? Number(raw) : 12;

// ---------------------------------------------------------------- households today

export async function currentCounts() {
  const active = await prisma.household.findMany({
    where: { status: HouseholdStatus.ACTIVE },
    select: { members: { select: { birthYear: true } } },
  });
  let adults = 0;
  let children = 0;
  let missing = 0;
  for (const h of active) {
    const n = countPeople(h.members);
    adults += n.adults;
    children += n.children;
    if (h.members.length === 0) missing++;
  }
  return {
    households: active.length,
    adults,
    children,
    people: adults + children,
    /** Active households with no members entered */
    missing,
  };
}

// ---------------------------------------------------------------- status history

type Change = { at: number; status: string };

/** The status at a moment in time, from a list of changes sorted oldest first. */
function statusAt(changes: Change[], ms: number): string | null {
  let status: string | null = null;
  for (const c of changes) {
    if (c.at >= ms) break;
    status = c.status;
  }
  return status;
}

function groupChanges(
  rows: { id: string; status: string; changedAt: Date }[],
  key: (r: { id: string }) => string,
) {
  const map = new Map<string, Change[]>();
  for (const r of rows) {
    const list = map.get(key(r)) ?? [];
    list.push({ at: r.changedAt.getTime(), status: r.status });
    map.set(key(r), list);
  }
  for (const list of map.values()) list.sort((a, b) => a.at - b.at);
  return map;
}

// ---------------------------------------------------------------- households over time

export type HouseholdTrend = {
  labels: string[];
  activeHouseholds: number[];
  householdsServed: number[];
  peopleServed: number[];
  adultsServed: number[];
  childrenServed: number[];
  /** Households served in this period that have no members entered */
  servedWithoutCounts: number;
  /** Households with no status history, whose past status is estimated */
  estimated: number;
};

export async function householdTrend(count: number): Promise<HouseholdTrend> {
  const months = lastMonths(count);

  const households = await prisma.household.findMany({
    where: {
      status: {
        in: [
          HouseholdStatus.ACTIVE,
          HouseholdStatus.INACTIVE,
          HouseholdStatus.ARCHIVED,
        ],
      },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      members: { select: { birthYear: true } },
    },
  });
  const byId = new Map(households.map((h) => [h.id, h]));

  const history = groupChanges(
    (
      await prisma.householdStatusChange.findMany({
        select: { householdId: true, status: true, changedAt: true },
      })
    ).map((c) => ({ id: c.householdId, status: c.status, changedAt: c.changedAt })),
    (r) => r.id,
  );

  // One row per completed visit; the date is the appointment, else the planned day, else when
  // the booking was made. The size is what was saved when it was completed.
  const visits = (
    await prisma.appointmentBookings.findMany({
      where: { status: AppointmentBookingStatus.COMPLETE },
      select: {
        householdId: true,
        createdAt: true,
        plannedStart: true,
        adultCount: true,
        childCount: true,
        appointment: { select: { startTime: true } },
      },
    })
  ).map((b) => ({
    householdId: b.householdId,
    at: b.appointment?.startTime ?? b.plannedStart ?? b.createdAt,
    adults: b.adultCount,
    children: b.childCount,
  }));

  // Only for households with no history yet: the last visit stands in for when they stopped
  const lastVisit = new Map<string, number>();
  for (const v of visits) {
    const t = v.at.getTime();
    if (t > (lastVisit.get(v.householdId) ?? 0)) lastVisit.set(v.householdId, t);
  }

  const trend: HouseholdTrend = {
    labels: months.map((m) => m.label),
    activeHouseholds: [],
    householdsServed: [],
    peopleServed: [],
    adultsServed: [],
    childrenServed: [],
    servedWithoutCounts: 0,
    estimated: households.filter((h) => !history.has(h.id)).length,
  };
  const noCounts = new Set<string>();

  for (const m of months) {
    // Active at the end of the month
    let active = 0;
    for (const h of households) {
      const changes = history.get(h.id);
      if (changes) {
        if (statusAt(changes, m.end.getTime()) === HouseholdStatus.ACTIVE) active++;
      } else if (
        h.createdAt < m.end &&
        (h.status === HouseholdStatus.ACTIVE ||
          (lastVisit.get(h.id) ?? 0) >= m.start.getTime())
      ) {
        active++;
      }
    }

    // Served: each household once, with the size from its latest completed visit that month
    const served = new Map<string, { at: number; adults: number | null; children: number | null }>();
    for (const v of visits) {
      if (v.at < m.start || v.at >= m.end || !byId.has(v.householdId)) continue;
      const t = v.at.getTime();
      const prev = served.get(v.householdId);
      if (!prev || t > prev.at) served.set(v.householdId, { at: t, adults: v.adults, children: v.children });
    }
    let adults = 0;
    let children = 0;
    for (const [id, v] of served) {
      // visits completed before sizes were saved use the household's current members
      const h = byId.get(id)!;
      const saved = v.adults != null || v.children != null;
      const n = saved
        ? { adults: v.adults ?? 0, children: v.children ?? 0 }
        : countPeople(h.members, new Date(v.at).getFullYear());
      adults += n.adults;
      children += n.children;
      if (n.adults + n.children === 0) noCounts.add(id);
    }
    trend.activeHouseholds.push(active);
    trend.householdsServed.push(served.size);
    trend.adultsServed.push(adults);
    trend.childrenServed.push(children);
    trend.peopleServed.push(adults + children);
  }
  trend.servedWithoutCounts = noCounts.size;
  return trend;
}

// ---------------------------------------------------------------- volunteers over time

export async function volunteerTrend(count: number) {
  const months = lastMonths(count);
  const volunteers = await prisma.volunteer.findMany({
    select: { id: true, createdAt: true, archivedAt: true },
  });
  const history = groupChanges(
    (
      await prisma.volunteerStatusChange.findMany({
        select: { volunteerId: true, status: true, changedAt: true },
      })
    ).map((c) => ({ id: c.volunteerId, status: c.status, changedAt: c.changedAt })),
    (r) => r.id,
  );

  return {
    labels: months.map((m) => m.label),
    activeVolunteers: months.map(
      (m) =>
        volunteers.filter((v) => {
          const changes = history.get(v.id);
          if (changes) return statusAt(changes, m.end.getTime()) === "ACTIVE";
          // no history yet: registered, and not archived by then
          return v.createdAt < m.end && (!v.archivedAt || v.archivedAt >= m.end);
        }).length,
    ),
    estimated: volunteers.filter((v) => !history.has(v.id)).length,
  };
}

// ---------------------------------------------------------------- expenses by month

export type ExpenseMonth = {
  label: string;
  /** Approved and reimbursed expenses (plus those awaiting review, when asked for) */
  count: number;
  totalCents: number;
  taxCents: number;
  /** Still waiting to be approved or rejected */
  pendingCount: number;
  pendingCents: number;
};

/**
 * Expenses by the month of the purchase date. Rejected expenses are never counted. Approved and
 * reimbursed ones make up the totals; ones awaiting review are added to them when
 * `includePending` is set, and are always shown on their own.
 */
export async function expensesByMonth(count: number, includePending: boolean) {
  const months = lastMonths(count);
  const first = months[0].key;
  const rows = await prisma.expense.findMany({
    where: {
      status: { not: ExpenseStatus.REJECTED },
      // purchaseDate is a plain date; fetch a day either side and match by month below
      purchaseDate: {
        gte: new Date(months[0].start.getTime() - 2 * 864e5),
        lt: new Date(months[months.length - 1].end.getTime() + 2 * 864e5),
      },
    },
    select: { purchaseDate: true, status: true, amountCents: true, taxCents: true },
  });

  const byKey = new Map<string, ExpenseMonth>(
    months.map((m) => [
      m.key,
      { label: m.label, count: 0, totalCents: 0, taxCents: 0, pendingCount: 0, pendingCents: 0 },
    ]),
  );
  for (const e of rows) {
    const key = e.purchaseDate.toISOString().slice(0, 7); // a date, so UTC is the day entered
    const m = byKey.get(key);
    if (!m || key < first) continue;
    if (e.status === ExpenseStatus.PENDING) {
      m.pendingCount++;
      m.pendingCents += e.amountCents;
      if (!includePending) continue;
    }
    m.count++;
    m.totalCents += e.amountCents;
    m.taxCents += e.taxCents ?? 0;
  }
  const list = months.map((m) => byKey.get(m.key)!);
  return {
    months: list,
    totals: list.reduce(
      (t, m) => ({
        count: t.count + m.count,
        totalCents: t.totalCents + m.totalCents,
        taxCents: t.taxCents + m.taxCents,
        pendingCents: t.pendingCents + m.pendingCents,
      }),
      { count: 0, totalCents: 0, taxCents: 0, pendingCents: 0 },
    ),
  };
}
