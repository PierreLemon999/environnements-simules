# MockupForge — Contexte pour Environnements Simulés

Ce fichier fournit le contexte necessaire pour interagir avec MockupForge via son API REST.

## Qu'est-ce que MockupForge

MockupForge est un viewer et annotateur de maquettes HTML generees par IA.
Stockage 100% fichiers (JSON + HTML/CSS/JS), zero BDD.
Chaque maquette a plusieurs versions, et les utilisateurs laissent des retours visuels
(annotations) que l'IA doit traiter dans les iterations suivantes.

## Projet

- **Nom** : Environnements Simulés
- **Slug** : environnements-simules
- **URL API** : `http://localhost:8420`

## Structure de stockage

```
projects/environnements-simules/
  project.json                        # Metadonnees projet + instructions IA
  <mockup-slug>/
    mockup.json                       # Nom, description, tags, categorie
    v1/
      index.html                      # Maquette HTML
      style.css                       # CSS (optionnel si inline)
      script.js                       # JS (optionnel)
      meta.json                       # Provider, modele, prompt, iteration
    retours/
      R001.json                       # Retour : texte, geste, coordonnees, resolved
      R001.png                        # Screenshot annote
```

## Endpoints principaux

### Lister les maquettes
```bash
curl http://localhost:8420/api/projects/environnements-simules/mockups
```

### Versions d'une maquette
```bash
curl http://localhost:8420/api/mockups/environnements-simules/<mockup>/versions
```

### Detail d'une version (html, css, js, meta)
```bash
curl http://localhost:8420/api/versions/environnements-simules/<mockup>/<version>
```

### Preview HTML (page complete pour iframe)
```bash
curl http://localhost:8420/api/preview/environnements-simules/<mockup>/<version>
```

### Lister les retours d'une maquette
```bash
curl http://localhost:8420/api/feedback/environnements-simules/<mockup>
```

### Creer un retour
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"version":"v1","text":"Modifier la couleur du bouton","gesture":"general"}' \
  http://localhost:8420/api/feedback/environnements-simules/<mockup>
```

### Creer une nouvelle version (injecter du HTML)
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"html":"<html>...</html>","provider":"claude","model":"opus"}' \
  http://localhost:8420/api/mockups/environnements-simules/<mockup>/versions
```

### Resoudre un retour
```bash
curl -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"resolved":true}' \
  http://localhost:8420/api/feedback/environnements-simules/<mockup>/<feedback-id>
```

### Export structure pour IA (markdown)
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"format":"markdown","validated_only":false}' \
  http://localhost:8420/api/export/environnements-simules/ai
```

## Format des retours (feedback)

Les fichiers JSON dans `retours/` contiennent :
- `id` : identifiant (R001, R002...)
- `version` : version concernee (v1, v2...)
- `text` : commentaire texte
- `gesture` : type (frame, arrow, move, designate, strikethrough, general)
- `coordinates` / `from` + `to` + `vector` : donnees spatiales
- `resolved` : false par defaut, passe a true apres traitement

Pour les deplacements (`move`), les champs `from`, `to`, `vector` (dx/dy)
encodent le mouvement pour que l'IA puisse l'interpreter sans voir le screenshot.

## Workflow type

1. Lire les retours non resolus : `GET /api/feedback/environnements-simules/<mockup>`
2. Filtrer `resolved: false`
3. Lire le HTML de la version courante : `GET /api/versions/environnements-simules/<mockup>/<version>`
4. Appliquer les modifications demandees
5. Creer une nouvelle version : `POST /api/mockups/environnements-simules/<mockup>/versions`
6. Marquer les retours traites : `PATCH /api/feedback/environnements-simules/<mockup>/<id>` avec `resolved: true`

## Instructions IA du projet

- Code front dans les memes langages que l'app cible
- Pas de simplifications dans les maquettes, reprendre exactement la forme de l'app cible et de l'app a modifier
- Convention de nommage : maquette-{projet}-{maquette}
- Generer et maintenir une description du projet et des modifications dans le mockup.json associe
- Placer les fichiers de retours dans le dossier retours/ et les consulter avant chaque iteration
- Ne pas modifier les retours resolus, les marquer comme resolved: true
- les maquettes attendues sont des désign complet et non des mockup simples
-Les maquettes doivent être le plus annimés possible. Potentiellement ils devraient pouvoir être transposables tel qel dans l'applicatif et utiliser les même frameworks JS que la cible.  
