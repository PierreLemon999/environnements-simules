<script lang="ts">
	import { upload } from '$lib/api';
	import { updateAvatarUrl, user } from '$lib/stores/auth';
	import { X, Upload, Loader2, ZoomIn, ZoomOut } from 'lucide-svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let fileInput: HTMLInputElement = $state(null!);
	let previewUrl = $state('');
	let file: File | null = $state(null);
	let saving = $state(false);
	let error = $state('');

	// Drag-to-recenter state
	let offsetX = $state(0);
	let offsetY = $state(0);
	let zoom = $state(1);
	let dragging = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartOffsetX = 0;
	let dragStartOffsetY = 0;
	let imageNaturalW = $state(0);
	let imageNaturalH = $state(0);

	function reset() {
		previewUrl = '';
		file = null;
		offsetX = 0;
		offsetY = 0;
		zoom = 1;
		error = '';
		saving = false;
	}

	function close() {
		reset();
		open = false;
	}

	function onFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const f = input.files?.[0];
		if (!f) return;
		if (!f.type.startsWith('image/')) {
			error = 'Veuillez sélectionner une image.';
			return;
		}
		file = f;
		error = '';
		offsetX = 0;
		offsetY = 0;
		zoom = 1;

		const reader = new FileReader();
		reader.onload = () => {
			previewUrl = reader.result as string;
			// Get natural dimensions
			const img = new Image();
			img.onload = () => {
				imageNaturalW = img.naturalWidth;
				imageNaturalH = img.naturalHeight;
			};
			img.src = previewUrl;
		};
		reader.readAsDataURL(f);
	}

	function onMouseDown(e: MouseEvent) {
		if (!file) return;
		dragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragStartOffsetX = offsetX;
		dragStartOffsetY = offsetY;
		e.preventDefault();
	}

	function onMouseMove(e: MouseEvent) {
		if (!dragging) return;
		offsetX = dragStartOffsetX + (e.clientX - dragStartX);
		offsetY = dragStartOffsetY + (e.clientY - dragStartY);
	}

	function onMouseUp() {
		dragging = false;
	}

	function onTouchStart(e: TouchEvent) {
		if (!file || !e.touches[0]) return;
		dragging = true;
		dragStartX = e.touches[0].clientX;
		dragStartY = e.touches[0].clientY;
		dragStartOffsetX = offsetX;
		dragStartOffsetY = offsetY;
	}

	function onTouchMove(e: TouchEvent) {
		if (!dragging || !e.touches[0]) return;
		offsetX = dragStartOffsetX + (e.touches[0].clientX - dragStartX);
		offsetY = dragStartOffsetY + (e.touches[0].clientY - dragStartY);
		e.preventDefault();
	}

	function adjustZoom(delta: number) {
		zoom = Math.max(0.5, Math.min(3, zoom + delta));
	}

	async function save() {
		if (!file) return;
		saving = true;
		error = '';

		try {
			// Calculate crop parameters based on offset + zoom
			// The preview circle is 200px, the image is scaled by zoom
			// We need to map the visual offset to actual pixel coordinates
			const containerSize = 200;
			const scale = Math.min(imageNaturalW, imageNaturalH) / (containerSize * zoom);
			const centerX = imageNaturalW / 2;
			const centerY = imageNaturalH / 2;
			const cropSize = Math.round(containerSize * scale);
			const cropX = Math.round(centerX - cropSize / 2 - offsetX * scale);
			const cropY = Math.round(centerY - cropSize / 2 - offsetY * scale);

			const formData = new FormData();
			formData.append('avatar', file);
			formData.append('cropX', String(Math.max(0, cropX)));
			formData.append('cropY', String(Math.max(0, cropY)));
			formData.append('cropSize', String(cropSize));

			const res = await upload<{ data: { avatarUrl: string } }>('/users/me/avatar', formData);
			updateAvatarUrl(res.data.avatarUrl);
			close();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Erreur lors de l\'upload.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onmousemove={onMouseMove} onmouseup={onMouseUp} ontouchmove={onTouchMove} ontouchend={onMouseUp} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()}></div>

	<div class="modal" role="dialog" aria-modal="true">
		<div class="modal-header">
			<h3 class="modal-title">Photo de profil</h3>
			<button class="modal-close" onclick={close}><X size={18} /></button>
		</div>

		<div class="modal-body">
			<!-- Preview -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="preview-container"
				onmousedown={onMouseDown}
				ontouchstart={onTouchStart}
				style="cursor: {file ? (dragging ? 'grabbing' : 'grab') : 'default'}"
			>
				{#if previewUrl}
					<img
						src={previewUrl}
						alt="Preview"
						class="preview-img"
						style="transform: translate({offsetX}px, {offsetY}px) scale({zoom})"
						draggable="false"
					/>
				{:else if $user?.avatarUrl}
					<img src={$user.avatarUrl} alt={$user.name} class="preview-img current" draggable="false" />
				{:else}
					<div class="preview-placeholder">
						<Upload size={32} />
						<span>Aucune photo</span>
					</div>
				{/if}
			</div>

			{#if file}
				<div class="zoom-controls">
					<button class="zoom-btn" onclick={() => adjustZoom(-0.1)} title="Dézoomer"><ZoomOut size={16} /></button>
					<input type="range" min="0.5" max="3" step="0.05" bind:value={zoom} class="zoom-slider" />
					<button class="zoom-btn" onclick={() => adjustZoom(0.1)} title="Zoomer"><ZoomIn size={16} /></button>
				</div>
				<p class="hint">Glissez pour repositionner</p>
			{/if}

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				onchange={onFileSelect}
				class="hidden"
			/>

			<div class="actions">
				<button class="btn-secondary" onclick={() => fileInput.click()}>
					<Upload size={14} />
					{file ? 'Changer l\'image' : 'Choisir une image'}
				</button>
				{#if file}
					<button class="btn-primary" onclick={save} disabled={saving}>
						{#if saving}
							<Loader2 size={14} class="animate-spin" />
						{/if}
						Enregistrer
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
	}
	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: white;
		border-radius: 16px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
		width: 340px;
		z-index: 201;
		overflow: hidden;
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
	}
	.modal-title {
		font-size: 15px;
		font-weight: 600;
	}
	.modal-close {
		display: flex;
		padding: 4px;
		border: none;
		background: none;
		color: var(--color-muted);
		cursor: pointer;
		border-radius: 6px;
		transition: all 0.15s;
	}
	.modal-close:hover {
		background: var(--color-accent);
		color: var(--color-foreground);
	}
	.modal-body {
		padding: 24px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}
	.preview-container {
		width: 200px;
		height: 200px;
		border-radius: 50%;
		overflow: hidden;
		border: 3px solid var(--color-border);
		background: var(--color-input, #f0f1f2);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		user-select: none;
		-webkit-user-select: none;
	}
	.preview-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
		transition: transform 0.05s linear;
	}
	.preview-img.current {
		transform: none;
	}
	.preview-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		color: var(--color-muted);
		font-size: 13px;
	}
	.zoom-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		max-width: 220px;
	}
	.zoom-btn {
		display: flex;
		padding: 6px;
		border: 1px solid var(--color-border);
		background: white;
		border-radius: 6px;
		cursor: pointer;
		color: var(--color-muted-foreground);
		transition: all 0.15s;
	}
	.zoom-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}
	.zoom-slider {
		flex: 1;
		accent-color: var(--color-primary);
		height: 4px;
	}
	.hint {
		font-size: 12px;
		color: var(--color-muted);
		margin-top: -8px;
	}
	.error {
		font-size: 13px;
		color: var(--color-error, #ef4444);
		text-align: center;
	}
	.hidden { display: none; }
	.actions {
		display: flex;
		gap: 10px;
		width: 100%;
	}
	.btn-secondary {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 9px 16px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: white;
		font-size: 13px;
		font-weight: 500;
		font-family: inherit;
		color: var(--color-foreground);
		cursor: pointer;
		transition: all 0.15s;
	}
	.btn-secondary:hover {
		border-color: #d1d5db;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
	}
	.btn-primary {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 9px 16px;
		border: none;
		border-radius: 8px;
		background: var(--color-primary);
		font-size: 13px;
		font-weight: 500;
		font-family: inherit;
		color: white;
		cursor: pointer;
		transition: all 0.15s;
	}
	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-hover, #245FC6);
	}
	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
