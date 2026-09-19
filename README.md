# Mes heures

Application personnelle de suivi du temps de travail, installable comme PWA sur téléphone.

La passation fonctionnelle et technique destinée aux prochaines reprises du développement se trouve dans [`README_LEON.md`](README_LEON.md).

## Architecture active

L’application repose désormais sur une base consolidée, sans empilement de scripts de version :

- `core.js` : stockage local, migration des anciennes données, dates, pointages et utilitaires.
- `domain.js` : règles métier uniques pour plannings, journées types, événements, prévisions, compteurs et soldes.
- `actual-day.js` : éditeur unique des journées réellement pointées.
- `v17.js` : exports CSV/PDF uniquement.
- `ui.js` : interface. Les différentes cartes appellent les mêmes fonctions métier de `domain.js`.

Les anciens scripts `v9`, `v10`, etc. ont été retirés du dépôt. Une fonction métier ne doit pas être réimplémentée dans une vue différente.

## Principes métier

- Les pointages sont la réalité : le planning ne fabrique jamais d’heures réellement travaillées.
- L’objectif hebdomadaire est le repère principal.
- Les heures futures ne créent pas de dette dans le solde courant.
- Les semaines et années sont rattachées au lundi de la semaine.
- Une semaine appartient entièrement au mois et à l’année de son lundi ; elle n’est jamais découpée au changement de mois ou d’année.
- Une récupération réduit le travail prévu ; une absence neutralisée crédite la partie prévue concernée.
- Une modification faite depuis Aujourd’hui, Prévisions ou Réglages agit sur la même donnée métier.
- Les données restent localement sur l’appareil dans cette version.
- L’agenda professionnel est une source de contexte éventuelle, pas une preuve automatique d’heures travaillées.

## Journées réelles et pauses

- La journée type applicable à la date fournit les horaires et la pause prévus.
- Les pointages réels remplacent les horaires lorsqu’ils existent, sans effacer les autres règles prévues.
- Une pause ne remplace celle du planning que lorsqu’elle a été volontairement personnalisée (`pauseExplicit: true`).
- Les pauses certaines provenant des anciens imports (`pause`) sont migrées comme données réelles explicites ; elles ne sont pas remplacées par le planning actuel.
- Aujourd’hui, Historique, les compteurs et les exports lisent tous `domain.actualPause()` et `domain.actualWorked()`.
- Une plage dont l’heure de fin est antérieure à l’heure de début se termine le lendemain et reste attachée au jour où elle a commencé.

## Historique hebdomadaire

- Les semaines importées dans `historicalWeeks` restent les références consolidées.
- Les semaines postérieures sont reconstruites par `domain.historyWeekRows()` à partir des journées réelles.
- Une semaine passée avec une journée normalement travaillée encore absente est marquée « À compléter » ; aucun écart définitif n’est inventé.
- Historique > Semaines, Historique > Années et les exports utilisent la même série hebdomadaire.

## Vérifications locales

Lancer les régressions métier avant publication :

```bash
node tests/regressions.js
```

Elles couvrent notamment NORJ à 90 minutes, la personnalisation d’une pause, le travail après minuit, la continuité S35–S37, les semaines incomplètes, le travail un jour prévu à 0 h et le rattachement d’une semaine à son lundi.

## À finaliser après validation de cette base

Import, sauvegarde/restauration, notifications et éventuelle lecture de l’agenda professionnel.
