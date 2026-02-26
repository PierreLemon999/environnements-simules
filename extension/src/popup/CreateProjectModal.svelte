<script lang="ts">
	let { onClose, onCreate }: {
		onClose: () => void;
		onCreate: (data: { name: string; toolName: string }) => void;
	} = $props();

	let name = $state('');
	let toolName = $state('');
	let isSubmitting = $state(false);

	let subdomain = $derived(
		toolName.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
	);

	function handleSubmit() {
		if (!name.trim() || !toolName.trim()) return;
		isSubmitting = true;
		onCreate({ name: name.trim(), toolName: toolName.trim() });
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="dialog">
	<div class="bg-white rounded-xl shadow-xl w-[340px] mx-4 overflow-hidden">
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
			<h2 class="text-sm font-semibold text-gray-900">Nouveau projet</h2>
			<button
				onclick={onClose}
				class="text-gray-400 hover:text-gray-600 transition p-0.5"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>

		<!-- Form -->
		<div class="px-4 py-3 space-y-3">
			<div>
				<label class="block text-[11px] font-medium text-gray-600 mb-1">Nom du projet</label>
				<input
					type="text"
					bind:value={name}
					placeholder="Ex: Salesforce CRM"
					class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
				/>
			</div>

			<div>
				<label class="block text-[11px] font-medium text-gray-600 mb-1">Nom de l'outil</label>
				<input
					type="text"
					bind:value={toolName}
					placeholder="Ex: Salesforce"
					class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
				/>
			</div>

			{#if subdomain}
				<div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 rounded-lg">
					<span class="text-[10px] text-gray-400">Sous-domaine :</span>
					<span class="text-[10px] font-mono text-gray-600">{subdomain}</span>
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
			<button
				onclick={onClose}
				class="flex-1 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
			>
				Annuler
			</button>
			<button
				onclick={handleSubmit}
				disabled={!name.trim() || !toolName.trim() || isSubmitting}
				class="flex-1 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
			>
				{#if isSubmitting}
					Création...
				{:else}
					Créer
				{/if}
			</button>
		</div>
	</div>
</div>
