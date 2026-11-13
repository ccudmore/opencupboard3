import { parseAamva, textFromBytes, type LicenceInfo } from './aamva';

// Reads barcodes in the browser with zxing-wasm (works in Safari and Chrome, unlike the browser's
// built-in BarcodeDetector). Nothing is uploaded: the pictures only ever exist in this page's memory.

export type ScanOutcome =
	| { kind: 'licence'; licence: LicenceInfo }
	/** a barcode was read, but it isn't a driver's licence or provincial ID card */
	| { kind: 'other' }
	| { kind: 'none' };

type Reader = typeof import('zxing-wasm/reader');
let loading: Promise<Reader> | null = null;

/** Loads the reader the first time it's needed (the code and its .wasm file are served by this app, not a CDN). */
function load(): Promise<Reader> {
	return (loading ??= (async () => {
		const [reader, wasm] = await Promise.all([import('zxing-wasm/reader'), import('zxing-wasm/reader/zxing_reader.wasm?url')]);
		await reader.prepareZXingModule({
			overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm.default : prefix + path) },
			fireImmediately: true
		});
		return reader;
	})().catch((err) => {
		loading = null; // allow another try
		throw err;
	}));
}

type Binarizer = 'LocalAverage' | 'FixedThreshold' | 'GlobalHistogram';
type Variant = { scale: number; binarizer: Binarizer };

// A real Ontario licence photographed at full size only decoded with the FixedThreshold binarizer, or
// after shrinking the picture, and not with the library default. How well each works depends on the
// camera, the light and the distance, so several are tried.
const LIVE_ROUNDS: Variant[][] = [
	[{ scale: 1, binarizer: 'LocalAverage' }, { scale: 1, binarizer: 'FixedThreshold' }],
	[{ scale: 0.5, binarizer: 'FixedThreshold' }, { scale: 0.5, binarizer: 'LocalAverage' }],
	[{ scale: 0.75, binarizer: 'FixedThreshold' }, { scale: 1, binarizer: 'GlobalHistogram' }]
];
const ALL_VARIANTS: Variant[] = LIVE_ROUNDS.flat();
let round = 0;

function shrink(image: ImageData, scale: number): ImageData {
	if (scale === 1) return image;
	const w = Math.max(1, Math.round(image.width * scale));
	const h = Math.max(1, Math.round(image.height * scale));
	const src = document.createElement('canvas');
	src.width = image.width;
	src.height = image.height;
	src.getContext('2d')!.putImageData(image, 0, 0);
	const dst = document.createElement('canvas');
	dst.width = w;
	dst.height = h;
	const ctx = dst.getContext('2d', { willReadFrequently: true })!;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(src, 0, 0, w, h);
	return ctx.getImageData(0, 0, w, h);
}

/**
 * Looks for a licence barcode in one picture. A live camera calls this over and over, so each call
 * tries one round of settings and the next call the next round; a single photo tries them all.
 */
export async function scanImageData(image: ImageData, tryAll = false): Promise<ScanOutcome> {
	const { readBarcodes } = await load();
	const variants = tryAll ? ALL_VARIANTS : LIVE_ROUNDS[round++ % LIVE_ROUNDS.length];
	let sawOther = false;
	for (const v of variants) {
		const found = await readBarcodes(shrink(image, v.scale), {
			formats: ['PDF417', 'QRCode'],
			tryHarder: true,
			tryRotate: true,
			binarizer: v.binarizer,
			maxNumberOfSymbols: 2
		});
		for (const code of found) {
			if (!code.isValid) continue;
			const licence = parseAamva(textFromBytes(code.bytes));
			if (licence) return { kind: 'licence', licence };
			sawOther = true;
		}
	}
	return sawOther ? { kind: 'other' } : { kind: 'none' };
}

/** Looks for a licence barcode in a photo the person chose. The photo is not kept. */
export async function scanFile(file: File): Promise<ScanOutcome> {
	const bitmap = await createImageBitmap(file);
	try {
		const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height)); // very large photos are slow and can fail on phones
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return { kind: 'none' };
		ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		return await scanImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), true);
	} finally {
		bitmap.close();
	}
}