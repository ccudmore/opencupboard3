import { env } from '$env/dynamic/private';

/** Largest accepted upload, in bytes (MAX_UPLOAD_MB, default 10). */
export function maxUploadBytes(): number {
	const mb = Number(env.MAX_UPLOAD_MB);
	return (Number.isFinite(mb) && mb > 0 ? mb : 10) * 1024 * 1024;
}

// The kinds of file that can be uploaded. The type is decided here, from the file's own
// first bytes and its extension, so the browser cannot get something unexpected served back.

type DocumentType = {
	contentType: string;
	/** Shown in the browser when opened, instead of being downloaded. */
	inline: boolean;
	/** True when the file starts with the bytes this type should start with. */
	matches: (b: Uint8Array) => boolean;
};

const startsWith = (b: Uint8Array, bytes: number[], offset = 0) =>
	bytes.every((value, i) => b[offset + i] === value);

const PDF = { contentType: 'application/pdf', inline: true, matches: (b: Uint8Array) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) };
const JPEG = { contentType: 'image/jpeg', inline: true, matches: (b: Uint8Array) => startsWith(b, [0xff, 0xd8, 0xff]) };
const PNG = { contentType: 'image/png', inline: true, matches: (b: Uint8Array) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) };
const WEBP = {
	contentType: 'image/webp',
	inline: true,
	matches: (b: Uint8Array) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)
};
const DOCX = {
	contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	inline: false,
	matches: (b: Uint8Array) => startsWith(b, [0x50, 0x4b, 0x03, 0x04])
};
const DOC = {
	contentType: 'application/msword',
	inline: false,
	matches: (b: Uint8Array) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
};
const TXT = {
	contentType: 'text/plain; charset=utf-8',
	inline: true,
	// plain text has no signature: accept it when the start of the file has no NUL bytes
	matches: (b: Uint8Array) => !b.subarray(0, 8192).includes(0)
};

const BY_EXTENSION: Record<string, DocumentType> = {
	pdf: PDF,
	jpg: JPEG,
	jpeg: JPEG,
	png: PNG,
	webp: WEBP,
	docx: DOCX,
	doc: DOC,
	txt: TXT
};

/** For the file picker's `accept` attribute and for error messages. */
export const ALLOWED_EXTENSIONS = Object.keys(BY_EXTENSION);

/** The type for this file, or null if it isn't allowed or its contents don't match its name. */
export function identifyDocument(fileName: string, bytes: Uint8Array): DocumentType | null {
	const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
	const type = Object.hasOwn(BY_EXTENSION, ext) ? BY_EXTENSION[ext] : undefined;
	return type && type.matches(bytes) ? type : null;
}

/** Whether a stored content type may be shown inside the browser. */
export function isInline(contentType: string): boolean {
	return Object.values(BY_EXTENSION).some((t) => t.contentType === contentType && t.inline);
}

/** A file name that is safe to store and show: no folders, no control characters, not too long. */
export function cleanFileName(raw: string): string {
	const base = raw.split(/[\\/]/).pop() ?? '';
	// eslint-disable-next-line no-control-regex
	const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
	const name = cleaned.slice(-200);
	return name || 'document';
}
