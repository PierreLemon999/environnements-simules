# Frontend — SvelteKit (Svelte 5) + Tailwind v3

## Structure

```
src/
├── +layout.svelte            # Root layout, hydratation auth au mount
├── lib/
│   ├── api.ts                # Client HTTP, injection JWT auto, upload multipart
│   ├── stores/
│   │   ├── auth.ts           # user, token, isAuthenticated, login/logout
│   │   └── toast.ts          # Notifications
│   └── components/
│       ├── ui/               # 30 composants shadcn-svelte (créés manuellement)
│       ├── layout/           # Sidebar, Header, CommandPalette
│       └── validation/       # ValidationInventoryPanel, ValidationRuleEditor
└── routes/
    ├── login/                # Email/password + Google SSO
    ├── admin/                # Layout avec sidebar → toutes les pages admin
    ├── demo/[...path]/       # Viewer démo (client authentifié)
    └── view/[...path]/       # Viewer démo (prospect, token)
```

## Patterns Svelte 5

```svelte
<script>
  let { prop1, prop2 } = $props();          // Props
  let count = $state(0);                     // État réactif
  let doubled = $derived(count * 2);         // Valeur calculée
  $effect(() => { /* side effect */ });      // Effet
</script>

{#snippet renderItem(item)}                  <!-- Template réutilisable -->
  <span>{item.name}</span>
{/snippet}
```

## API Client (`$lib/api.ts`)

- Base URL : `http://localhost:3001/api` (dev) ou `PUBLIC_API_BASE_URL` (prod)
- JWT injecté automatiquement dans `Authorization: Bearer {token}`
- Méthodes : `get`, `post`, `put`, `patch`, `del`, `upload`
- Erreurs : throw `ApiError(status, code, message)`

## Composants UI

shadcn-svelte installé manuellement (pas via CLI) car Tailwind v3.
Base : bits-ui pour les primitives headless.
Ne PAS tenter d'utiliser `npx shadcn-svelte@latest add` — ça échouera.

Composants notables : Avatar, AvatarEditor, Badge, Button, Card, Dialog, DropdownMenu, Input, SearchableSelect, Separator, Tabs, Toast, Tooltip.

## Sidebar (Linear-style)

- 220px expanded / 48px collapsed (icon-only)
- Sections : PRINCIPAL (Dashboard, Projets, Arborescence, Analytics, Invitations), GESTION (Utilisateurs, Obfuscation, Demandes MAJ, Paramètres)
- Active : texte bleu + bordure gauche 3px bleu
