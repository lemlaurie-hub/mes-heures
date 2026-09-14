# Mes heures

Application personnelle de suivi du temps de travail, installable comme PWA sur téléphone.

## Architecture active

L’application repose désormais sur une base consolidée, sans empilement de scripts de version :

- `core.js` : stockage local, migration des anciennes données, dates, pointages et utilitaires.
- `domain.js` : règles métier uniques pour plannings, journées types, événements, prévisions, compteurs et soldes.
- `v17.js` : exports CSV/PDF uniquement.
- `ui.js` : interface. Les différentes cartes appellent les mêmes fonctions métier de `domain.js`.

Les anciens scripts `v9`, `v10`, etc. ont été retirés du dépôt. Une fonction métier ne doit pas être réimplémentée dans une vue différente.

## Principes métier

- Les pointages sont la réalité : le planning ne fabrique jamais d’heures réellement travaillées.
- L’objectif hebdomadaire est le repère principal.
- Les heures futures ne créent pas de dette dans le solde courant.
- Les semaines et années sont rattachées au lundi de la semaine.
- Une récupération réduit le travail prévu ; une absence neutralisée crédite la partie prévue concernée.
- Une modification faite depuis Aujourd’hui, Prévisions ou Réglages agit sur la même donnée métier.
- Les données restent localement sur l’appareil dans cette version.
- L’agenda professionnel est une source de contexte éventuelle, pas une preuve automatique d’heures travaillées.

## À finaliser après validation de cette base

Import, sauvegarde/restauration, notifications et éventuelle lecture de l’agenda professionnel.
