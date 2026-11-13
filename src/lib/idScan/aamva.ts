// Reads the barcode on the back of a driver's licence or provincial photo ID card.
// North American licences, Ontario's included, follow the AAMVA standard: a PDF417 barcode whose
// text starts "@", a header containing "ANSI ", and then lines of three-letter fields
// (DCS = family name, DAC = given name, DBB = date of birth and so on).
//
// Only the fields the household pages can use are kept: name, birth and expiry dates, issuer, and
// the address (used only to pre-fill a new household's form). The licence number is deliberately
// dropped here, so it can't end up stored or logged by accident.

export type LicenceInfo = {
  familyName: string;
  givenNames: string;
  /** YYYY-MM-DD, or '' if it couldn't be read */
  birthDate: string;
  /** YYYY-MM-DD, or '' */
  expiryDate: string;
  /** The province or state that issued it, such as "ON" */
  issuer: string;
  /** The address on the card, '' when absent. Only used to pre-fill a new household. */
  street: string;
  city: string;
  postalCode: string;
};

const PROVINCES: Record<string, string> = {
  ON: "Ontario",
  QC: "Quebec",
  BC: "British Columbia",
  AB: "Alberta",
  MB: "Manitoba",
  SK: "Saskatchewan",
  NS: "Nova Scotia",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  PE: "Prince Edward Island",
  NT: "Northwest Territories",
  YT: "Yukon",
  NU: "Nunavut",
};

/** "ON" becomes "Ontario"; anything not a Canadian code is returned as it was. */
export const provinceName = (code: string) =>
  PROVINCES[code.trim().toUpperCase()] ?? code;

/** "k1a0b1" becomes "K1A 0B1"; anything else is returned tidied but otherwise as it was. */
export function formatPostal(raw: string): string {
  const c = raw.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(c)
    ? `${c.slice(0, 3)} ${c.slice(3)}`
    : raw.trim();
}

/**
 * The text of a barcode from its raw bytes. (The reader's own `text` shows control characters as
 * "<LF>", which would hide the line breaks that separate the fields.) Licences use ISO-8859-1, but a
 * few issuers use UTF-8, so UTF-8 is tried first.
 */
export function textFromBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Dates are YYYYMMDD in Canada and MMDDYYYY in the US. Returns YYYY-MM-DD, or '' when it isn't a date. */
export function parseAamvaDate(raw: string, canadian: boolean): string {
  const d = raw.trim();
  if (!/^\d{8}$/.test(d)) return "";
  const yearFirst =
    canadian ||
    (Number(d.slice(0, 4)) >= 1900 &&
      Number(d.slice(0, 4)) <= 2200 &&
      Number(d.slice(0, 2)) > 12);
  const [y, m, day] = yearFirst
    ? [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)]
    : [d.slice(4, 8), d.slice(0, 2), d.slice(2, 4)];
  const month = Number(m);
  const dayNum = Number(day);
  if (month < 1 || month > 12 || dayNum < 1 || dayNum > 31) return "";
  return `${y}-${m}-${day}`;
}

const title = (s: string) => s.trim().replace(/\s+/g, " ");

/** The licence details from the text of a barcode, or null when it isn't an AAMVA licence or ID card. */
export function parseAamva(text: string): LicenceInfo | null {
  // every AAMVA barcode has this in its header
  if (!text.includes("ANSI ")) return null;

  const fields = new Map<string, string>();
  for (const line of text.split(/[\r\n]+/)) {
    const m = line.match(/^(?:DL|ID)?(D[A-Z]{2})(.*)$/);
    if (m && !fields.has(m[1])) fields.set(m[1], m[2]);
  }
  if (fields.size === 0) return null;

  const canadian = (fields.get("DCG") ?? "").trim().toUpperCase() === "CAN";

  let familyName = fields.get("DCS") ?? "";
  let givenNames = [fields.get("DAC"), fields.get("DAD")]
    .filter(Boolean)
    .join(" ");
  // older cards put the whole name in one field: LAST,FIRST,MIDDLE
  if (!familyName && fields.get("DAA")) {
    const [last, ...rest] = fields.get("DAA")!.split(/[,$]/);
    familyName = last;
    givenNames = rest.join(" ");
  }
  if (!familyName && !givenNames) return null;

  return {
    familyName: title(familyName),
    givenNames: title(givenNames),
    birthDate: parseAamvaDate(fields.get("DBB") ?? "", canadian),
    expiryDate: parseAamvaDate(fields.get("DBA") ?? "", canadian),
    issuer: title(fields.get("DAJ") ?? ""),
    street: title(fields.get("DAG") ?? ""),
    city: title(fields.get("DAI") ?? ""),
    postalCode: formatPostal(fields.get("DAK") ?? ""),
  };
}

// ---------------------------------------------------------------- comparing with the household member

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();

/** Does the name entered for the member agree with the one on the licence? Ignores case, accents, punctuation and middle names. */
export function namesAgree(
  member: { firstName?: string | null; lastName?: string | null },
  licence: LicenceInfo,
) {
  const memberFirst = plain(member.firstName ?? "");
  const memberLast = plain(member.lastName ?? "");
  const given = plain(licence.givenNames).split(" ").filter(Boolean);
  const family = plain(licence.familyName);

  const first =
    !!memberFirst &&
    (given.includes(memberFirst.split(" ")[0]) ||
      given.join(" ").startsWith(memberFirst));
  const last =
    !!memberLast &&
    !!family &&
    (memberLast === family ||
      family.includes(memberLast) ||
      memberLast.includes(family));
  return { first, last };
}

export const birthYearOf = (licence: LicenceInfo) =>
  licence.birthDate ? Number(licence.birthDate.slice(0, 4)) : null;

/** Today's date in YYYY-MM-DD in the browser's time zone, for comparing with the expiry date. */
export const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
