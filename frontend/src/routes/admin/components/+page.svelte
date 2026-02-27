<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import {
		Blocks,
		Layout,
		Type,
		MousePointer,
		Table2,
		PanelLeft,
		Search,
		Bell,
		MessageSquare,
		ToggleLeft,
		Calendar,
		ChevronRight,
	} from 'lucide-svelte';

	const componentGroups = [
		{
			name: 'Navigation',
			items: [
				{ name: 'Sidebar', description: 'Barre latérale collapsible avec sections et badges', icon: PanelLeft, status: 'stable' },
				{ name: 'Header', description: 'Barre supérieure avec breadcrumb, recherche et actions', icon: Layout, status: 'stable' },
				{ name: 'Command Palette', description: 'Palette de commandes Cmd+K avec recherche multi-catégorie', icon: Search, status: 'stable' },
			]
		},
		{
			name: 'Données',
			items: [
				{ name: 'Data Table', description: 'Tableau avec tri, filtre, pagination et actions', icon: Table2, status: 'stable' },
				{ name: 'Tree View', description: 'Arborescence de pages avec nœuds expansibles et indicateurs', icon: Blocks, status: 'stable' },
				{ name: 'Stats Card', description: 'Carte de statistique avec icône, valeur et delta', icon: Type, status: 'stable' },
			]
		},
		{
			name: 'Formulaires',
			items: [
				{ name: 'Input', description: 'Champ de saisie avec label et validation', icon: Type, status: 'stable' },
				{ name: 'Dialog', description: 'Modale de formulaire avec header, contenu et footer', icon: MessageSquare, status: 'stable' },
				{ name: 'Toggle', description: 'Interrupteur on/off avec label', icon: ToggleLeft, status: 'stable' },
			]
		},
		{
			name: 'Feedback',
			items: [
				{ name: 'Toast', description: 'Notifications temporaires (succès, erreur, info)', icon: Bell, status: 'stable' },
				{ name: 'Badge', description: 'Étiquette colorée pour statuts et compteurs', icon: MousePointer, status: 'stable' },
				{ name: 'Tooltip', description: 'Info-bulle au survol', icon: MousePointer, status: 'stable' },
			]
		},
	];

	function getStatusColor(status: string): string {
		switch (status) {
			case 'stable': return 'bg-green-100 text-green-700';
			case 'beta': return 'bg-amber-100 text-amber-700';
			case 'planned': return 'bg-muted text-muted-foreground';
			default: return 'bg-muted text-muted-foreground';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'stable': return 'Stable';
			case 'beta': return 'Bêta';
			case 'planned': return 'Prévu';
			default: return status;
		}
	}
</script>

<svelte:head>
	<title>Composants — Environnements Simulés</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h2 class="text-lg font-semibold text-foreground">Composants</h2>
		<p class="text-sm text-muted-foreground mt-1">Bibliothèque des composants UI de la plateforme</p>
	</div>

	<!-- Stats -->
	<div class="flex items-center gap-4 text-sm text-muted-foreground">
		<span>{componentGroups.reduce((acc, g) => acc + g.items.length, 0)} composants</span>
		<span class="text-border">•</span>
		<span>{componentGroups.length} catégories</span>
		<span class="text-border">•</span>
		<div class="flex items-center gap-1">
			<span class="h-2 w-2 rounded-full bg-green-500"></span>
			<span>Tous stables</span>
		</div>
	</div>

	<!-- Component groups -->
	{#each componentGroups as group}
		<div>
			<h3 class="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">{group.name}</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
				{#each group.items as component}
					<Card class="group hover:border-primary/30 transition-colors cursor-default">
						<CardContent class="p-4">
							<div class="flex items-start gap-3">
								<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/70 group-hover:bg-primary/10 transition-colors">
									<svelte:component this={component.icon} class="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<p class="text-sm font-medium">{component.name}</p>
										<Badge variant="secondary" class="text-[9px] px-1.5 py-0 {getStatusColor(component.status)}">
											{getStatusLabel(component.status)}
										</Badge>
									</div>
									<p class="text-xs text-muted-foreground mt-0.5 line-clamp-2">{component.description}</p>
								</div>
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>
		</div>
	{/each}
</div>
