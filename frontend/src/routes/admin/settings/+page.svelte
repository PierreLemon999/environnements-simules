<script lang="ts">
	import { onMount } from 'svelte';
	import { get, post, put } from '$lib/api';
	import { toast } from '$lib/stores/toast';
	import { user } from '$lib/stores/auth';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import {
		Settings,
		Globe,
		Key,
		Server,
		Database,
		Shield,
		Code,
		ExternalLink,
		Copy,
		Check,
		Info,
		AlertTriangle,
		Eye,
		EyeOff,
	} from 'lucide-svelte';

	// Platform info
	let platformInfo = $state({
		version: '1.0.0',
		environment: 'development',
		dbSize: '—',
		uploadsSize: '—',
		totalPages: 0,
		totalProjects: 0,
	});

	// Tag manager defaults (global)
	let defaultScriptUrl = $state('');
	let defaultConfigJson = $state('');

	// API Key
	let apiKeySet = $state(false);
	let apiKeyPreview = $state('');
	let showApiKeyInput = $state(false);
	let newApiKey = $state('');
	let showApiKeyValue = $state(false);

	let loading = $state(true);
	let copied = $state(false);

	// SSO domains
	const ssoDomains = [
		'lemonlearning.com',
		'lemonlearning.fr',
		'goldfuchs-software.de',
	];

	function maskApiKey(key: string): string {
		if (!key || key.length < 10) return '••••••••';
		return key.slice(0, 7) + '••••••••••••' + key.slice(-4);
	}

	onMount(async () => {
		try {
			const [projectsRes, analyticsRes] = await Promise.all([
				get('/projects'),
				get('/analytics/overview'),
			]);
			const projects = projectsRes.data || [];
			const overview = analyticsRes.data || {};

			let totalPages = 0;
			for (const p of projects) {
				totalPages += p.pageCount || 0;
			}

			platformInfo = {
				version: '1.0.0',
				environment: window.location.hostname === 'localhost' ? 'development' : 'production',
				dbSize: '—',
				uploadsSize: '—',
				totalPages,
				totalProjects: projects.length,
			};

			// Check if API key is configured (from env or stored)
			try {
				const keyRes = await get('/settings/api-key-status');
				apiKeySet = keyRes.data?.configured ?? false;
				apiKeyPreview = keyRes.data?.preview ?? '';
			} catch {
				apiKeySet = false;
				apiKeyPreview = '';
			}
		} catch (err) {
			console.error('Settings fetch error:', err);
		} finally {
			loading = false;
		}
	});

	async function saveApiKey() {
		if (!newApiKey.trim()) {
			toast.error('Veuillez saisir une clé API');
			return;
		}
		try {
			await post('/settings/api-key', { apiKey: newApiKey.trim() });
			apiKeySet = true;
			apiKeyPreview = maskApiKey(newApiKey.trim());
			newApiKey = '';
			showApiKeyInput = false;
			toast.success('Clé API enregistrée de manière sécurisée');
		} catch {
			toast.error('Erreur lors de l\'enregistrement de la clé API');
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => { copied = false; }, 2000);
		toast.success('Copié dans le presse-papiers');
	}
</script>

<svelte:head>
	<title>Paramètres admin — Lemon Lab</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h2 class="text-lg font-semibold text-foreground">Paramètres admin</h2>
		<p class="text-sm text-muted-foreground mt-1">Configuration générale de la plateforme</p>
	</div>

	<!-- Platform info -->
	<Card>
		<CardHeader class="pb-3">
			<div class="flex items-center gap-2">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
					<Server class="h-4 w-4 text-primary" />
				</div>
				<CardTitle class="text-sm font-medium">Plateforme</CardTitle>
			</div>
		</CardHeader>
		<CardContent>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div>
					<p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Version</p>
					<p class="text-sm font-medium mt-1">{platformInfo.version}</p>
				</div>
				<div>
					<p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Environnement</p>
					<div class="flex items-center gap-1.5 mt-1">
						<span class="h-2 w-2 rounded-full {platformInfo.environment === 'production' ? 'bg-green-500' : 'bg-amber-500'}"></span>
						<p class="text-sm font-medium">{platformInfo.environment === 'production' ? 'Production' : 'Développement'}</p>
					</div>
				</div>
				<div>
					<p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Projets</p>
					<p class="text-sm font-medium mt-1">{platformInfo.totalProjects}</p>
				</div>
				<div>
					<p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pages capturées</p>
					<p class="text-sm font-medium mt-1">{platformInfo.totalPages}</p>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Tag Manager -->
	<Card>
		<CardHeader class="pb-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
						<Code class="h-4 w-4 text-violet-500" />
					</div>
					<div>
						<CardTitle class="text-sm font-medium">Tag Manager</CardTitle>
						<p class="text-xs text-muted-foreground mt-0.5">Script Lemon Learning injecté dans les démos</p>
					</div>
				</div>
				<Badge variant="outline" class="text-[10px]">Par projet</Badge>
			</div>
		</CardHeader>
		<CardContent>
			<div class="space-y-4">
				<div>
					<label for="script-url" class="text-xs font-medium text-muted-foreground">URL du script (par défaut)</label>
					<Input
						id="script-url"
						bind:value={defaultScriptUrl}
						placeholder="https://cdn.lemonlearning.com/player.js"
						class="mt-1.5 text-sm"
					/>
				</div>
				<div>
					<label for="config-json" class="text-xs font-medium text-muted-foreground">Configuration JSON (par défaut)</label>
					<textarea
						id="config-json"
						bind:value={defaultConfigJson}
						placeholder={'{"profileId": "...", "locale": "fr"}'}
						class="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
					></textarea>
				</div>
				<div class="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
					<Info class="h-3.5 w-3.5 flex-shrink-0" />
					<span>La configuration Tag Manager se fait par projet dans les paramètres de chaque projet. Ces valeurs servent de modèle par défaut.</span>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- API & Security -->
	<Card>
		<CardHeader class="pb-3">
			<div class="flex items-center gap-2">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
					<Key class="h-4 w-4 text-amber-500" />
				</div>
				<div>
					<CardTitle class="text-sm font-medium">API & Sécurité</CardTitle>
					<p class="text-xs text-muted-foreground mt-0.5">Clés API et configuration d'authentification</p>
				</div>
			</div>
		</CardHeader>
		<CardContent>
			<div class="space-y-4">
				<!-- API Key -->
				<div>
					<label class="text-xs font-medium text-muted-foreground">Clé API Claude (génération IA)</label>
					<div class="mt-1.5">
						{#if showApiKeyInput}
							<div class="flex items-center gap-2">
								<div class="relative flex-1">
									<Input
										bind:value={newApiKey}
										placeholder="sk-ant-api03-..."
										type={showApiKeyValue ? 'text' : 'password'}
										class="text-sm font-mono pr-10"
									/>
									<button
										type="button"
										class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										onclick={() => { showApiKeyValue = !showApiKeyValue; }}
									>
										{#if showApiKeyValue}
											<EyeOff class="h-3.5 w-3.5" />
										{:else}
											<Eye class="h-3.5 w-3.5" />
										{/if}
									</button>
								</div>
								<Button size="sm" variant="default" onclick={saveApiKey}>
									Enregistrer
								</Button>
								<Button size="sm" variant="ghost" onclick={() => { showApiKeyInput = false; newApiKey = ''; showApiKeyValue = false; }}>
									Annuler
								</Button>
							</div>
						{:else if apiKeySet}
							<div class="flex items-center gap-2">
								<div class="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/30 text-sm font-mono text-muted-foreground">
									<Key class="h-3.5 w-3.5 text-green-500" />
									<span>{apiKeyPreview}</span>
								</div>
								<Badge variant="secondary" class="text-[10px] bg-green-50 text-green-700 border-green-200">Configurée</Badge>
								<Button size="sm" variant="outline" onclick={() => { showApiKeyInput = true; }}>
									Modifier
								</Button>
							</div>
						{:else}
							<div class="flex items-center gap-2">
								<div class="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-amber-300 bg-amber-50/50 text-sm text-amber-700">
									<AlertTriangle class="h-3.5 w-3.5" />
									<span>Non configurée — les fonctionnalités IA ne sont pas disponibles</span>
								</div>
								<Button size="sm" variant="outline" onclick={() => { showApiKeyInput = true; }}>
									Configurer
								</Button>
							</div>
						{/if}
					</div>
				</div>

				<!-- Google SSO -->
				<div class="border-t border-border pt-4">
					<label class="text-xs font-medium text-muted-foreground">Authentification Google SSO</label>
					<div class="mt-1.5 space-y-1.5">
						{#each ssoDomains as domain}
							<div class="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
								<Shield class="h-3.5 w-3.5 text-green-500" />
								<span>@{domain}</span>
							</div>
						{/each}
					</div>
					<p class="mt-2 text-xs text-muted-foreground">
						Les utilisateurs avec un compte Google sur ces domaines sont automatiquement provisionnés en tant qu'administrateurs.
					</p>
				</div>

				<!-- JWT Tokens -->
				<div class="border-t border-border pt-4">
					<label class="text-xs font-medium text-muted-foreground">Tokens JWT</label>
					<div class="flex items-center gap-2 mt-1.5">
						<div class="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
							Expiration : 7 jours
						</div>
					</div>
					<p class="mt-2 text-xs text-muted-foreground">
						Les tokens JWT authentifient les sessions des administrateurs et des clients. Un token est émis à la connexion (SSO Google ou email/mot de passe) et renouvelé automatiquement par l'extension Chrome toutes les 30 minutes. En production, utilisez la variable d'environnement <code class="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">JWT_SECRET</code> pour définir une clé de signature sécurisée.
					</p>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- URLs & Domains -->
	<Card>
		<CardHeader class="pb-3">
			<div class="flex items-center gap-2">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
					<Globe class="h-4 w-4 text-green-500" />
				</div>
				<div>
					<CardTitle class="text-sm font-medium">Domaines & URLs</CardTitle>
					<p class="text-xs text-muted-foreground mt-0.5">Configuration des sous-domaines de démo</p>
				</div>
			</div>
		</CardHeader>
		<CardContent>
			<div class="space-y-3">
				<div class="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Domaine racine</p>
						<p class="text-sm font-medium mt-0.5">localhost:5173</p>
					</div>
					<Badge variant="outline" class="text-[10px]">Dev</Badge>
				</div>
				<div class="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
					<Info class="h-3.5 w-3.5 flex-shrink-0" />
					<span>En production, chaque projet utilise un sous-domaine (ex: salesforce.env01.com). Le domaine racine est configurable via les variables d'environnement Railway.</span>
				</div>
			</div>
		</CardContent>
	</Card>
</div>
