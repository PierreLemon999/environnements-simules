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
