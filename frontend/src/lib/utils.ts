import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx for conditional class names.
 * This is the standard utility used by shadcn-svelte components.
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Optimize an image file for logo storage: center-crop to square, resize, compress.
 * Returns a JPEG data URL. Max output size ~200x200px at quality 0.85.
 */
export function optimizeLogoImage(
	file: File,
	options: { maxSize?: number; quality?: number } = {}
): Promise<string> {
	const { maxSize = 200, quality = 0.85 } = options;

	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);

			// Center-crop to square
			const size = Math.min(img.width, img.height);
			const sx = (img.width - size) / 2;
			const sy = (img.height - size) / 2;

			// Target output size
			const outSize = Math.min(size, maxSize);

			const canvas = document.createElement('canvas');
			canvas.width = outSize;
			canvas.height = outSize;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Canvas context unavailable'));
				return;
			}

			ctx.drawImage(img, sx, sy, size, size, 0, 0, outSize, outSize);
			resolve(canvas.toDataURL('image/jpeg', quality));
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

/**
 * Extract the dominant color from a data URL image, excluding white/near-white pixels.
 * Returns a hex color string like "#2B72EE".
 */
export function extractDominantColor(dataUrl: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const size = 64; // downsample for speed
			const canvas = document.createElement('canvas');
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				resolve('#6D7481');
				return;
			}

			ctx.drawImage(img, 0, 0, size, size);
			const { data } = ctx.getImageData(0, 0, size, size);

			// Count colors in buckets (quantize to 4-bit per channel)
			const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

			for (let i = 0; i < data.length; i += 4) {
				const r = data[i];
				const g = data[i + 1];
				const b = data[i + 2];
				const a = data[i + 3];

				// Skip transparent or near-white pixels
				if (a < 128) continue;
				if (r > 230 && g > 230 && b > 230) continue;
				// Skip near-black too (often background)
				if (r < 25 && g < 25 && b < 25) continue;

				const key = `${(r >> 4)}-${(g >> 4)}-${(b >> 4)}`;
				const existing = buckets.get(key);
				if (existing) {
					existing.r += r;
					existing.g += g;
					existing.b += b;
					existing.count++;
				} else {
					buckets.set(key, { r, g, b, count: 1 });
				}
			}

			if (buckets.size === 0) {
				resolve('#6D7481');
				return;
			}

			// Find the most frequent bucket
			let best = { r: 109, g: 116, b: 129, count: 0 };
			for (const bucket of buckets.values()) {
				if (bucket.count > best.count) best = bucket;
			}

			// Average the color in the winning bucket
			const avgR = Math.round(best.r / best.count);
			const avgG = Math.round(best.g / best.count);
			const avgB = Math.round(best.b / best.count);

			const hex = '#' + [avgR, avgG, avgB].map(c => c.toString(16).padStart(2, '0')).join('');
			resolve(hex);
		};

		img.onerror = () => resolve('#6D7481');
		img.src = dataUrl;
	});
}
