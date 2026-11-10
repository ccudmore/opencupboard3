/** Shared by the expenses pages and the server: the lists of choices and how money and dates are shown. */

export const CATEGORIES = [
  { value: "DAIRY", label: "Dairy" },
  { value: "EGGS", label: "Eggs" },
  { value: "MEAT", label: "Meat" },
  { value: "OIL_MARGARINE", label: "Oil / margarine" },
  { value: "FORMULA", label: "Formula" },
  { value: "DIAPERS", label: "Diapers" },
  { value: "OTHER_FOOD", label: "Other (food)" },
  { value: "OTHER_NON_FOOD", label: "Other (non-food)" },
  { value: "TAX", label: "Tax" },
  { value: "OTHER", label: "Other (explain)" },
] as const;

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "PERSONAL_CARD", label: "Personal bank card" },
  { value: "ORG_CARD", label: "Organization bank card" },
  { value: "OTHER", label: "Other" },
] as const;

export const REIMBURSEMENT_METHODS = [
  { value: "E_TRANSFER", label: "E-transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CASH", label: "Cash" },
  { value: "DIRECT_DEPOSIT", label: "Direct deposit" },
  { value: "OTHER", label: "Other" },
] as const;

export const STATUSES = [
  { value: "PENDING", label: "Pending", color: "yellow" },
  { value: "APPROVED", label: "Approved", color: "blue" },
  { value: "REJECTED", label: "Rejected", color: "red" },
  { value: "REIMBURSED", label: "Reimbursed", color: "green" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]["value"];
export type ReimbursementValue =
  (typeof REIMBURSEMENT_METHODS)[number]["value"];
export type StatusValue = (typeof STATUSES)[number]["value"];

const labelOf = (
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
) => list.find((x) => x.value === value)?.label ?? value ?? "";

export const categoryLabel = (v: string) => labelOf(CATEGORIES, v);
export const paymentLabel = (v: string) => labelOf(PAYMENT_METHODS, v);
export const reimbursementLabel = (v: string | null | undefined) =>
  labelOf(REIMBURSEMENT_METHODS, v);
export const statusInfo = (v: string) =>
  STATUSES.find((s) => s.value === v) ?? STATUSES[0];

/** 1234 -> "$12.34" */
export const money = (cents: number | null | undefined) =>
  cents == null
    ? ""
    : (cents / 100).toLocaleString("en-CA", {
        style: "currency",
        currency: "CAD",
      });

/** A calendar date with no time of day ("2026-11-04" or a Date at UTC midnight) shown as "Nov 4, 2026". */
export function dateOnly(value: string | Date | null | undefined): string {
  if (!value) return "";
  const iso =
    typeof value === "string"
      ? value.slice(0, 10)
      : value.toISOString().slice(0, 10);
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** A Date picked in the browser (local time) as "2026-11-04". */
export function toIsoDate(d: Date | undefined | null): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "2026-11-04" as a Date at local midnight, for the date picker. */
export function fromIsoDate(s: string | null | undefined): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
