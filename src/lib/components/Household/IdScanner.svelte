<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { LicenceInfo } from '$lib/idScan/aamva';
	import { scanFile, scanImageData, type ScanOutcome } from '$lib/idScan/reader';

	let { onscan, onother }: { onscan: (licence: LicenceInfo) => void; onother?: () => void } = $props();

	let video: HTMLVideoElement | undefined = $state();
	let status = $state<'starting' | 'scanning' | 'error'>('starting');
	let message = $state('');
	let slow = $state(false);
	let resolution = $state('');

	let stream: MediaStream | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let slowTimer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	let canvas: HTMLCanvasElement | undefined;

	const MAX_WIDTH = 2560; // licence barcodes are dense, so frames are scanned at full size where the camera gives it

	function stop() {
		stopped = true;
		clearTimeout(timer);
		clearTimeout(slowTimer);
		stream?.getTracks().forEach((t) => t.stop()); // switches the camera light off
		stream = null;
		if (video) video.srcObject = null;
	}

	function finish(outcome: ScanOutcome): boolean {
		if (outcome.kind === 'licence') {
			stop();
			onscan(outcome.licence);
			return true;
		}
		if (outcome.kind === 'other') onother?.();
		return false;
	}

	async function tick() {
		if (stopped || !video) return;
		try {
			if (video.readyState >= 2 && video.videoWidth > 0) {
				const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
				const w = Math.round(video.videoWidth * scale);
				const h = Math.round(video.videoHeight * scale);
				canvas ??= document.createElement('canvas');
				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext('2d', { willReadFrequently: true });
				if (ctx) {
					ctx.drawImage(video, 0, 0, w, h);
					if (finish(await scanImageData(ctx.getImageData(0, 0, w, h)))) return;
				}
			}
		} catch (err) {
			console.error('Scanning failed:', err);
			status = 'error';
			message = 'The scanner could not start. Try again, or choose the ID type yourself.';
			stop();
			return;
		}
		if (!stopped) timer = setTimeout(tick, 120);
	}

	async function start() {
		if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
			status = 'error';
			message = 'This browser can only use the camera on a secure (https) page.';
			return;
		}
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
				audio: false
			});
			if (stopped || !video) {
				stop();
				return;
			}
			video.srcObject = stream;
			await video.play();
			// keep the card in focus when the browser supports it (ignored where it doesn't)
			await stream.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});
			status = 'scanning';
			const st = stream.getVideoTracks()[0]?.getSettings();
			if (st?.width && st?.height) resolution = `${st.width}×${st.height}`;
			slowTimer = setTimeout(() => (slow = true), 6000);
			tick();
		} catch (err) {
			const name = (err as DOMException)?.name;
			status = 'error';
			message =
				name === 'NotAllowedError'
					? 'The camera is blocked. Allow camera access for this site in your browser settings, then try again.'
					: name === 'NotFoundError'
						? 'No camera was found on this device.'
						: 'The camera could not be started.';
		}
	}

	$effect(() => {
		if (video) void start();
	});
	onDestroy(stop);

	async function fromPhoto(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		message = '';
		try {
			if (!finish(await scanFile(file))) message = 'No licence barcode was found in that picture. Use the back of the card, in good light.';
		} catch {
			message = 'That picture could not be read.';
		}
	}
</script>

<div class="space-y-2">
	{#if status !== 'error'}
		<div class="relative overflow-hidden rounded-lg bg-black">
			<!-- muted and playsinline are what let iPhones and iPads play the camera inside the page -->
			<video bind:this={video} class="aspect-video w-full object-cover" playsinline muted autoplay></video>
			<div class="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-white/70"></div>
		</div>
		<p class="text-sm text-gray-600 dark:text-gray-300" role="status">
			{status === 'starting' ? 'Starting the camera…' : 'Hold the back of the licence flat, with its barcode inside the frame.'}
			{#if slow}Hold the card about 20–30 cm (8–12 in) from the camera, tilt it slightly to avoid glare, and keep it steady. A laptop webcam can't focus up close. {#if resolution}Camera: {resolution}.{/if}{/if}
		</p>
	{/if}

	{#if message}<p class="error-text" role="alert">{message}</p>{/if}

	<div class="flex flex-wrap items-center gap-2">
		<label class="cursor-pointer">
			<span class="inline-block rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-100 dark:border-gray-500 dark:text-white dark:hover:bg-gray-700">Use a photo instead</span>
			<input type="file" accept="image/*" capture="environment" class="sr-only" onchange={fromPhoto} />
		</label>
		<span class="hint">The picture is read here and is not saved.</span>
	</div>
</div>