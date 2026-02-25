# Document complémentaire — Précisions et instructions

Ce document complète le fichier SPECS.md principal. Il contient les décisions techniques, précisions fonctionnelles et instructions détaillées issues des échanges de cadrage.

---

## Description enrichie du projet

Le but de ce projet est de créer des environnements simulés qui serviront à Lemon Learning (lemonlearning.com), pour 2 buts :
- Avoir des environnements stables pour permettre aux commerciaux de faire des démos
- Ouvrir des environnements de démos pour les prospects et pour les clients

À ces environnements sera intégré le player Lemon Learning (via intégration JavaScript injecté par un tag manager custom Lemon Learning). Le tag manager est simple et custom (pas Google Tag Manager). Il peut injecter des profils en variable JS qui peuvent différer selon la version. La documentation technique Lemon Learning sera fournie séparément.

Les outils simulés (Salesforce, SAP, etc.) sont gérés exclusivement par les équipes internes Lemon Learning, jamais par le client.

Le code est généré et maintenu par IA (Claude Code). Ne pas tenter d'économiser les tokens IA — faire les choses bien.

---

## Design et UI

### Librairie UI : shadcn-svelte

Style visuel : minimal/épuré, inspiré de Linear et Notion.

| Besoin | Composant |
|---|---|
| Sidebar navigation | `Sidebar` (collapsible, avec tree view) |
| Arbre/tree view | `shadcn-svelte-extras` Tree View |
| Tableaux de données | `Data Table` (tri, filtre, pagination) |
| Cards/vignettes | `Card` |
| Recherche globale | `Command` (palette ⌘K type Linear) |
| Infobulles | `Tooltip` |
| Modales | `Dialog` / `Sheet` / `Drawer` |
| Icônes | Lucide Icons |

### Stack design

```
shadcn-svelte          → composants UI
shadcn-svelte-extras   → tree view avancé
Tailwind CSS           → styling
Lucide Icons           → icônes
```

### Inspirations

**Admin :**
- Linear (linear.app) — sidebar, tree view projets, tables, palette ⌘K
- Notion — arbre de pages, cards, design épuré
- Vercel Dashboard — tables, logs, minimal

**Bandeau démo (côté prospect) :**
- Loom viewer — barre très discrète en haut
- Figma prototype mode — toolbar minimaliste overlay
- L'UI doit être quasi invisible. Tout tient en quelques icônes en haut à droite avec raccourcis rapides. Au survol/clic, infobulles avec le détail.

---

## Extension Chrome — Précisions

### Distribution

**Phase 1 (dev)** : téléchargement d'un .zip depuis l'admin, installation en mode développeur (chrome://extensions → Load unpacked).

**Phase 2 (stable)** : publication en mode "unlisted" sur le Chrome Web Store. Téléchargement depuis le store via lien direct.

### Détection dans l'admin

- Extension non installée → lien de téléchargement bien visible, en gros
- Extension installée mais pas à jour (mode dev) → invite à mettre à jour + suggestion de passer au Chrome Web Store
- Extension installée et à jour → rien de spécial

### Environnement de dev : Vite + CRXJS

L'extension utilise Vite + CRXJS pour le développement.

**Config minimale** (`vite.config.js`) :
```js
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default {
  plugins: [crx({ manifest })]
}
```

**En dev** : `npm run dev` → génère un dossier `dist/`. Charger ce dossier une seule fois dans chrome://extensions. Ensuite, à chaque sauvegarde de fichier, l'extension se recharge automatiquement (hot reload via websocket injecté par CRXJS). Pas besoin de toucher à chrome://extensions pendant le dev. Pas besoin d'incrémenter la version.

**En build** : `npm run build` → dossier `dist/` propre, prêt à zipper.

CRXJS supporte Svelte. Le popup et les pages d'options peuvent être écrits en Svelte. Le content script reste en JS pur.

L'incrémentation de version ne sert que pour les releases (publication store ou nouveau .zip).

---

## Capture — Précisions et features complètes

### Format

- Capture du DOM complet : HTML + CSS + JS condensés en un seul fichier
- Les ressources externes (images, fonts, CSS CDN) sont téléchargées et inlinées (base64 ou stockées à côté)
- Le JavaScript est adapté pour tout rendre statique
- Les iframes sont capturées récursivement et inlinées dans le fichier unique
- Les captures doivent être autosuffisantes
- Données réutilisables stockées en BDD (pas en localStorage)

### Gestion des liens

Gestion fine des liens entre les pages capturées. Les liens internes sont réécrits pour pointer vers les pages capturées correspondantes.

### Scroll et lazy loading

L'extension doit scroller la page entièrement avant de capturer le DOM, pour déclencher le chargement de tout le contenu lazy-loadé.

### Attente réseau (networkidle)

Attendre que toutes les requêtes AJAX soient terminées avant de capturer. Ne pas capturer des spinners/loaders.

### Exclusion de boutons dangereux

Liste noire configurable de sélecteurs/textes à ne jamais cliquer pendant le crawl automatique : "Déconnexion", "Se déconnecter", "Logout", "Supprimer", "Réinitialiser", "Delete", etc. Cette liste est configurable dans l'admin.

### Gestion des cookies/session

Pendant la capture auto/profondeur, maintenir la session active. Refresh token si besoin. L'utilisateur se connecte directement pendant la capture.

### Timeout et retry par page

Si une page met trop de temps ou plante, passer à la suivante et la marquer en erreur. Retry configurable.

### Resume/reprise

Si une capture (surtout auto) est interrompue, pouvoir la reprendre là où elle s'est arrêtée.

### Taille max par page

Alerter si une page capturée dépasse 10 Mo. Si une page dépasse ce seuil, en produire automatiquement une version simplifiée (suppression des assets lourds non essentiels, compression des images).

### Effets JavaScript

Prise en compte des effets JS : modales, dropdowns, chargements asynchrones, SPA routing. L'extension doit attendre la stabilisation du DOM après chaque interaction avant de capturer.

### Algorithme de profondeur — détail

1. L'utilisateur définit un nombre de pages cible
2. L'utilisateur peut naviguer manuellement sur plusieurs pages pour définir des "zones d'intérêt"
3. L'algorithme avance en BFS (breadth-first search) à partir de la page courante
4. Dans les zones d'intérêt, la profondeur de capture est plus importante
5. Attente du chargement complet (DOMContentLoaded + JS async + networkidle) avant chaque capture
6. Détection et gestion : SPA routing, modales, dropdowns, lazy loading
7. Évitement des boucles (tracking des URLs visitées, normalisation des URLs)
8. Arrêt quand le nombre de pages cible est atteint
9. L'algorithme ne doit jamais cliquer sur les boutons de la liste noire

---

## Obfuscation — Précisions

### Manuelle
Sélection d'éléments à obfusquer/changer : images, textes.

### Automatique
Système rechercher/remplacer configurable dans le back-office. Exemple : masquer le nom du client partout. Les termes à retraiter sont configurés dans l'admin.

### Persistance
L'obfuscation est persistante et s'applique aux données stockées (DOM capturé), pas juste au rendu visuel. Le middleware de service applique aussi les règles à chaque requête.

---

## Données fictives — Précisions

- Les données fictives sont souvent déjà présentes dans le logiciel source
- L'extension peut reproduire les données existantes OU en créer de nouvelles
- Quand les données sont nouvelles, analyse IA contextuelle : l'IA détecte automatiquement le type de champ (adresse, nom, email, société) ET le pays/la langue à partir des données existantes
- Génération cohérente : adresses françaises → adresses françaises, noms de sociétés → noms de sociétés, etc.
- Clé API Claude intégrée côté serveur

---

## Admin — Précisions

### Arbre de visualisation
- Vue arborescente de tout ce qui a été produit
- Organisable par arborescence réelle du site OU par guide/parcours
- Preview rapide : thumbnail/screenshot de chaque page capturée visible dans l'arbre sans devoir ouvrir la page
- Statut de santé des pages : indicateur visuel si une page a des erreurs (assets manquants, liens cassés vers d'autres pages non capturées)

### Pages en surplus
Les pages capturées "en plus" pour le réalisme sont présentes sans distinction dans l'arbre. Pas de marquage spécial.

### Recherche
- Recherche globale étendue (palette ⌘K) : chercher une page, un guide, un projet, un utilisateur par nom
- Recherches locales dans chaque vue (filtres dans les tables, recherche dans l'arbre)

### Projets & Versions
- Les projets de capture sont regroupés par outil
- Chaque version a une dénomination : "à jour", "test", "dépréciée"
- Les versions "à jour" s'affichent en priorité
- Chaque version affiche son auteur (nom + photo de profil)

### Authentification et provisionnement

Les utilisateurs Lemon Learning (admins) sont provisionnés automatiquement à leur première connexion via Google SSO. Tout email Lemon Learning crée un compte admin. Il est impossible de se connecter en tant qu'admin avec un email/mot de passe — seul Google SSO est accepté pour ce rôle.

Les prospects/clients se connectent uniquement via email + mot de passe (généré par le système lors de l'assignation d'une démo).

Note : les rôles "admin" et "commercial" sont fusionnés en un seul rôle "admin" avec les mêmes droits. Tous les utilisateurs Lemon Learning ont accès à toutes les fonctionnalités (admin, live edit, gestion clients, analytics, config technique).

### Live edit
- Admins uniquement
- Modification des textes directement dans la démo
- Les modifications s'appliquent directement sur le fichier HTML capturé (pas de système d'overlay)
- Persistantes

### Assignation de démos
- Une démo peut être assignée à un utilisateur spécifique (client/prospect)
- Le prospect reçoit un lien + un mot de passe
- Expiration réglable, par défaut 2 ans

### Demandes de mise à jour
- Un commercial signale une demande de mise à jour sur une page donnée, avec commentaire
- Vue centralisée de toutes les demandes (qui, quand, quoi)
- Les mises à jour sont liées au besoin d'évolution d'un guide ou de la démo, pas au besoin de coller avec l'application elle-même
- Pas de système de notification automatique

### Analytics & Logs
- Nombre de fois que chaque guide a été joué
- Temps passé par personne (données individualisées)
- Logs organisés par session OU par applicatif
- Le commercial peut filtrer par client ou voir une vue générale agrégée
- Clic sur une session → détail complet du parcours

### Profils utilisateurs
- Chaque utilisateur a un profil avec photo
- Visibilité sur qui fait quoi, qui est auteur de quoi
- Mettre en avant les contributeurs

### Export
- Exporter une démo complète en .zip (backup ou usage hors-ligne)
- Note : le player Lemon Learning ne sera pas disponible en hors-ligne

---

## Gestion des URLs

L'objectif est que les URLs aient l'air d'un vrai outil. Exemple : `salesforce.xxxx.com` où `xxxx` est un domaine très court qui ressemble à un sous-domaine d'infrastructure.

La racine doit être très courte. Les URLs longues type Salesforce sont supportées.

Nécessite un certificat SSL wildcard + config DNS. Railway le supporte.

Pistes de domaine : style "infra" (env01.com, apx0.com) ou .io/.app/.dev. Vérifier disponibilité sur Namecheap ou Porkbun.

---

## Infrastructure et hébergement

### Railway
- 2 services : frontend (SvelteKit) + backend (Express)
- 1 volume persistant attaché au backend (SQLite + fichiers HTML)
- 2 environnements : `dev` (branche dev) + `prod` (branche main)
- Déploiement auto sur push
- Facturation à l'usage, le stockage grandit automatiquement
- Plan Hobby ~5-15$/mois pour ce volume

### Estimation stockage
- Une page SaaS capturée : 2-5 Mo
- Une app complète (~50-100 écrans) : 100-500 Mo
- 10 apps : 1-5 Go → très gérable

### Évolution
- Si >1 Go de fichiers HTML : migration des fichiers vers Cloudflare R2 (10 Go gratuits, 0.015$/Go/mois). SQLite reste sur Railway.
- Si l'équipe DevOps prend le relais : migration AWS facile. Express → EC2/ECS. SQLite fonctionne sur EC2/ECS avec volume EBS (pas besoin de migrer vers PostgreSQL). Fichiers HTML → S3. Si besoin de PostgreSQL quand même, Drizzle ORM permet de changer le driver en 3 lignes.

---

## DevOps

### Repo
Monorepo Git avec `/frontend`, `/backend`, `/extension`, `/shared`.

### CI/CD — GitHub Actions
À chaque push : lint + tests → build → déploiement auto sur Railway.

### Environnements
- `main` → prod
- `dev` → staging

### Flux de travail
1. Dev en local (SvelteKit dev server + Express local + SQLite fichier local)
2. `git push dev` → GitHub Actions → déploiement staging Railway (URL type `dev-monprojet.up.railway.app`)
3. Vérification en ligne
4. Merge `dev` → `main` → déploiement prod

Pour l'extension Chrome : chargée en mode développeur localement, pointée vers backend local ou staging via variable d'environnement.

### Tests

| Type | Outil | Priorité | Quand |
|---|---|---|---|
| Unitaires | Vitest | Haute | Fin phase 1 |
| API | Supertest | Moyenne | Fin phase 1 |
| E2E | Playwright | Basse | Fin phase 2 |

Tests critiques : logique d'obfuscation, réécriture des liens, algorithme de profondeur, upload de captures.

### Monitoring
- Logs intégrés Railway au début
- Better Stack (free tier) quand en prod : uptime check toutes les 3 min, alertes email

### Backups
Cron quotidien qui copie le fichier SQLite + dossier captures HTML vers stockage distant.

### Ordre d'intégration DevOps

**Dès le début :**
1. Repo Git + structure monorepo
2. Railway connecté, 2 environnements

**Dès les premiers commits :**
3. GitHub Actions basique (lint + build + deploy)

**Fin phase 1 :**
4. Vitest + Supertest sur fonctions critiques
5. Better Stack monitoring

**Fin phase 2 :**
6. Backups automatisés
7. Playwright sur parcours critiques

**Quand l'équipe DevOps prend le relais :**
8. Migration AWS
9. Monitoring avancé

---

## Plan de développement phasé

### Phase 1 — Le cœur (2-3 semaines)
- Setup monorepo, CI/CD, déploiement Railway
- Backend Express + SQLite + Drizzle (tables: users, projects, versions, pages)
- Extension : capture libre (DOM → fichier unique → upload avec progression)
- Admin basique : arbre de visualisation, création projets/versions
- Serving des pages capturées (GET /demo/:subdomain/*)
- Détection extension dans l'admin + lien de téléchargement

**Résultat** : on peut capturer des pages et les servir.

### Phase 2 — L'usage (2-3 semaines)
- Obfuscation manuelle + automatique (rechercher/remplacer)
- Gestion des liens entre pages (réécriture au service)
- Versioning (snapshot, status, auteur)
- Rôles et accès (auth JWT, permissions par rôle)
- Assignation de démos aux prospects (lien + mot de passe + expiration)
- Recherche globale (palette ⌘K) + recherches locales
- Live edit (textes, admins + commerciaux)

**Résultat** : produit utilisable par les commerciaux.

### Phase 3 — L'automatisation (2-3 semaines)
- Capture pendant lecture d'un guide
- Capture automatique (tous les guides)
- Algorithme de profondeur + zones d'intérêt
- Liste noire de boutons dangereux
- Scroll complet + networkidle + gestion iframes
- Resume/reprise de captures interrompues
- Taille max par page + version simplifiée auto
- Suivi de progression dans l'extension (barre, statuts, retry)

**Résultat** : capture à grande échelle.

### Phase 4 — Le polish (2-3 semaines)
- Analytics et logs (sessions, événements, filtres, vue détail)
- Données fictives via IA (détection type + pays/langue auto + génération contextuelle)
- Duplicate & fork de versions
- Demandes de mise à jour (signalement, commentaires, vue centralisée)
- Export .zip (usage hors-ligne)
- Preview/thumbnails dans l'arbre
- Statut de santé des pages
- Publication extension sur Chrome Web Store (unlisted)
- UI polish : bandeau prospect, infobulles, raccourcis, profils avec photos

**Résultat** : produit complet.

---

## Conventions de code

- **Langue du code** : anglais (variables, fonctions, commentaires)
- **Langue du contenu** : français (UI, labels, messages)
- **Style** : Prettier + ESLint
- **Commits** : conventional commits (feat:, fix:, chore:)
- **Composants Svelte** : un composant par fichier, nommage PascalCase
- **API** : RESTful, réponses JSON, erreurs standardisées `{ error: string, code: number }`
- **Tests** : chaque fonction critique a un test Vitest associé
- **Qualité** : ne pas économiser les tokens IA, faire les choses bien
