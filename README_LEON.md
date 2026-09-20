# Passation Léon — Mes heures

Ce document est la mémoire de développement durable de l’application **Mes heures**. Il doit être lu avant toute intervention et mis à jour lorsqu’une règle, une décision fonctionnelle, une contrainte d’architecture, une anomalie importante ou un élément de feuille de route est ajouté ou modifié.

Il ne remplace pas la lecture du code actuel : **le dépôt reste la source de vérité technique**.

## 1. Méthode de travail

Avant toute modification :

1. lire le code réellement présent dans le dépôt et vérifier l’état Git ;
2. ne jamais supposer qu’une correction évoquée auparavant a été appliquée, poussée ou qu’elle fonctionne ;
3. reproduire ou localiser précisément l’anomalie ;
4. suivre le chemin complet de la donnée ;
5. comparer les différents écrans et exports qui consomment cette donnée ;
6. identifier la règle métier commune ;
7. corriger la cause, pas seulement l’affichage fautif ;
8. tester les cas normaux, les cas limites et les autres consommateurs ;
9. documenter la règle lorsqu’elle est stabilisée.

Une correction locale et sûre peut être faite directement. Une décision fonctionnelle nouvelle ou une évolution architecturale importante doit être expliquée avant modification.

Ne pas rester bloqué sur une méthode technique défaillante : changer d’approche jusqu’à obtenir une solution vérifiée ou une raison précise d’impossibilité.

### Publication GitHub depuis l’environnement Codex

Dans cet environnement, la commande terminal `git push` échoue régulièrement parce qu’aucun identifiant Git n’est configuré. Ne pas insister ni demander à Laurie de transmettre un mot de passe, une clé SSH ou un jeton dans la conversation.

Utiliser directement l’interface GitHub connectée pour créer les objets Git nécessaires et mettre à jour `main`, puis vérifier la tête distante. Le SHA du commit effectivement publié peut différer du SHA du commit local même lorsque leur contenu est identique.

## 2. Principe architectural

Principe fondamental : **une règle métier = une fonction ou une source de vérité commune**.

Les vues ne doivent pas recalculer séparément :

- la durée d’une journée ;
- la pause effective ;
- le planning applicable à une date ;
- l’objectif hebdomadaire ;
- le statut d’une journée ou d’une semaine ;
- le solde ;
- les projections annuelles.

L’organisation actuelle est :

- `core.js` : stockage local, migrations, dates et utilitaires bas niveau ;
- `domain.js` : règles métier communes ;
- `actual-day.js` : éditeur unique des journées réelles ;
- `ui.js` : interface ;
- `v17.js` : CSV et PDF ;
- `reprise.js` : reprise du compteur ;
- `projection-detail.js` : détail de la projection annuelle ;
- `tests/regressions.js` : régressions métier à exécuter avant publication.

Éviter l’empilement de scripts correctifs ou les variantes du type `calculateDurationForHistory`. Les fonctions importantes doivent être commentées utilement : rôle, donnée attendue, règle appliquée et cas particuliers.

## 3. Finalité et diffusion

L’application pallie les difficultés de saisie régulière et de reconstitution des heures, mais elle est destinée à pouvoir être diffusée individuellement à l’équipe, notamment aux apprenties.

Conséquences :

- ne pas coder de comportement secret propre à Laurie ;
- les particularités doivent être des données configurables ;
- chaque personne utilise sa propre installation ;
- les données restent sur son téléphone ;
- aucun compte ni serveur central ne rassemble les relevés ;
- les PDF mensuels et annuels servent à transmettre volontairement les données.

L’adresse du N+1 doit pouvoir être enregistrée dans les paramètres. À terme, le PDF pourra être partagé par l’application de messagerie choisie sur le téléphone. L’application prépare le document et le destinataire ; l’utilisatrice confirme elle-même l’envoi. Aucun envoi automatique en arrière-plan.

## 4. Modèle fonctionnel

Ordre des règles :

**Journées types → Plannings → périodes particulières → journées réelles.**

Le planning principal s’applique par défaut. Il n’a pas besoin d’une période d’application. Les plannings secondaires ou exceptionnels remplacent le principal pendant leurs périodes définies. Les plannings peuvent avoir des versions avec date d’effet.

Exemples importants de la configuration MJC :

- `NORM` : 09:00–18:30, pause 30 min, durée attendue 9h00 ;
- `NORJ` : 09:00–18:30, pause 90 min, durée attendue 8h00 ;
- les 90 minutes de NORJ correspondent à 1 h de chi et 30 min de repas ;
- `ACM` : journée type propre aux périodes ACM.

Le moteur ne connaît pas le chi : il applique seulement la journée type enregistrée.

## 5. Prévu et réel

Le planning fournit la base prévue. Le pointage réel remplace uniquement les éléments réellement saisis.

- Modifier une heure de départ ne doit pas effacer la pause prévue.
- Une pause volontairement personnalisée est prioritaire (`pauseExplicit: true`).
- Sans personnalisation explicite, la pause vient de la journée type applicable à la date.
- Une pause certaine provenant d’un ancien import reste une donnée réelle explicite.
- `domain.actualPause()` et `domain.actualWorked()` sont les sources communes utilisées par l’interface, les compteurs et les exports.

L’application ne doit jamais inventer une journée travaillée pour compléter ses totaux.

- Une journée normalement travaillée sans pointage reste à traiter.
- Un jour arrivé à sa date, prévu à 0 h et sans pointage est automatiquement affiché « Validée » ; aucune journée réelle fictive n’est créée.
- Un jour prévu à 0 h avec un pointage devient une véritable journée travaillée et entre dans les calculs.

Une plage peut se terminer après minuit. Par exemple `09:31 → 00:20` signifie 00:20 le lendemain et reste attaché à la journée où le travail a commencé.

## 6. Semaines, mois et années

Une semaine est attachée à son lundi.

**Toute la semaine appartient au mois et à l’année de son lundi**, même si elle se termine dans le mois ou l’année suivante. Elle n’est jamais découpée.

Le format d’affichage est `S01`, `S02`, etc. Les dates techniques restent en `YYYY-MM-DD` dans le stockage, mais l’interface doit afficher des dates françaises.

Les semaines importées dans `historicalWeeks` restent les références consolidées. Les semaines suivantes sont reconstruites par `domain.historyWeekRows()` à partir des journées réelles.

- semaine importée : `Consolidée` ;
- semaine passée complète : `Calculée` ;
- semaine passée avec une journée attendue mais absente : `À compléter`, sans écart final inventé ;
- semaine courante : `En cours`, sans écart hebdomadaire définitif.

Historique > Semaines, Historique > Années et les exports doivent lire cette même série.

Les lignes de semaines sont dépliables. Leur détail présente les sept journées et permet d’ouvrir l’éditeur « Modifier » pour une journée ancienne. Pour une semaine importée consolidée, le total hebdomadaire reste la référence même si le détail journalier disponible est incomplet.

## 7. Calculs à ne pas confondre

- **prévu** : ce que le planning annonce ;
- **réel** : ce qui a été pointé ou retenu ;
- **objectif** : obligation contractuelle de la période ;
- **projection** : réel acquis combiné au futur prévu ;
- **solde actuel** : situation acquise aujourd’hui ;
- **report** : solde transféré entre exercices.

Les heures futures ne sont jamais une dette actuelle. L’objectif hebdomadaire peut évoluer dans le temps et ne doit pas être codé comme une constante universelle de 35 h.

Un changement de planning, de contrat, d’objectif ou de journée type ne doit pas réinterpréter arbitrairement le passé. Toujours demander : **quelle règle était applicable à cette date ?**

## 8. Écrans

### Aujourd’hui

Écran de pointage quotidien : date, planning applicable, prévu, plages réelles, état, arrivée/départ, modification de la journée et résumé de la semaine.

Le résumé comprend pointé/retenu, objectif, reste à faire, solde actuel et écart de la semaine.

### Historique

- `Récent` : semaine courante du lundi au dimanche ;
- `Semaines` : semaines consolidées puis reconstruites ;
- `Années` : semaines et journées regroupées selon le lundi ;
- `Régularisations` : ajustements explicites, distincts d’une journée fictive.

Les données affichées et celles proposées par « Modifier » doivent provenir du même modèle.

### Prévisions

Combine le passé réel, le présent selon les règles définies et le futur prévu. Affiche notamment objectif annuel, réalisé, projection au 31/12, résultat prévu, report N-1 et report N+1 projeté.

Dans le calendrier annuel, le clic sur une semaine dépend de sa position dans le temps :

- semaine terminée : afficher le réel des sept journées et permettre leur correction ;
- journée normalement travaillée sans donnée réelle : la signaler en rouge « À compléter » ;
- semaine courante ou future : afficher le planning prévu et ses outils de planification ;
- semaine historique uniquement consolidée : permettre la ressaisie progressive de ses journées, tout en gardant le total consolidé comme référence jusqu’à validation explicite.

### Reconstitution progressive des semaines consolidées

Une utilisatrice peut ressaisir progressivement les vraies journées d’une ancienne semaine importée sous forme de total.

- Les journées ressaisies sont enregistrées normalement dans `days`.
- Tant que le remplacement n’est pas validé, tous les calculs continuent d’utiliser `historicalWeeks` : une ressaisie partielle ne fait donc pas dériver le solde.
- L’écran affiche le total consolidé, le total du détail disponible, leur écart et le nombre de journées attendues déjà complétées.
- Les jours prévus à 0 h ne bloquent pas la complétude ; un travail réel éventuellement saisi sur ces jours reste compté.
- Le bouton de remplacement n’est disponible que lorsque toutes les journées normalement travaillées sont renseignées ou couvertes par une valeur retenue.
- La validation est toujours explicite et précédée d’une confirmation indiquant l’effet chiffré.
- Après validation, la consolidation d’origine est déplacée dans `replacedHistoricalWeeks` avec sa date de remplacement et le nouveau total. Les journées deviennent alors la source des calculs.
- Une semaine ainsi reconstituée doit rester visible dans l’historique, même si elle se trouvait au milieu d’une série de semaines consolidées.
- L’éditeur réel propose « Enregistrer puis ajouter/modifier l’événement » : la journée est sauvegardée avant l’ouverture de l’événement, avec sa date déjà renseignée.
- Si l’éditeur de journée ou d’événement a été ouvert depuis le détail d’une semaine, conserver cette semaine comme contexte de retour et la rouvrir après enregistrement ou retrait. L’utilisatrice doit pouvoir enchaîner la ressaisie puis valider le remplacement sans rechercher une seconde fois la semaine.

### Démarrage depuis un solde sans détail antérieur

Le point de référence (`balanceReferenceDate` et `balanceReferenceMinutes`) couvre toute la période jusqu’à la date indiquée incluse. Il n’a pas à être découpé artificiellement en semaines consolidées.

- Le calcul détaillé commence le lendemain de la date de référence.
- Une semaine entièrement antérieure à cette date n’a rien à compléter.
- Pour la semaine de raccord, seules les journées postérieures à la référence sont demandées.
- Si la référence se trouve dans l’année consultée, les indicateurs « objectif annuel », « réalisé annuel » et « résultat annuel » ne doivent pas être affichés comme s’ils étaient connus.
- À leur place, afficher le solde de référence, le solde actuel, l’évolution acquise depuis la référence, le solde projeté au 31/12 et le report N+1 projeté.
- Le PDF annuel commence à la semaine de raccord. Sur cette première semaine partielle, ne pas afficher un objectif ou un écart hebdomadaire complet qui serait trompeur.
- Les données antérieures éventuellement ressaisies restent informatives tant que la date de référence n’est pas déplacée volontairement.

### Docs admin

Destiné aux exports, imports, sauvegardes et futurs documents administratifs. Une sauvegarde restaurable est différente d’un CSV d’exploitation.

## 9. Événements

Événements prévus : congés, arrêt maladie, récupération, formation, jour férié, réunion et autres événements professionnels utiles.

- Une période multi-jours doit être saisissable en une fois.
- Aucun motif personnel inutile ne doit être demandé pour un arrêt maladie.
- Certains événements neutralisent l’écart par rapport à l’objectif au lieu de représenter du travail pointé.
- Les jours fériés sont déterminés automatiquement ; un jour férié travaillé reste un cas distinct.

## 10. Formats

- Dates visibles : `18/09/2026` ou `vendredi 18 septembre`.
- Ne pas afficher une date ISO brute dans l’interface.
- Durées : `35h00`, `8h00`, `1h44`.
- Écarts : `+3h51`, `-18h28`.
- Éviter les heures décimales dans l’interface.

## 11. Feuille de route

Ces éléments sont prévus, sans être nécessairement déjà développés :

### Import assisté

- ancien Excel/CSV ;
- correspondance des colonnes ;
- prévisualisation ;
- distinction données certaines, reconstituées et incomplètes ;
- détection des lignes ambiguës ;
- confirmation avant écriture ;
- prévention des doublons ;
- écriture via le modèle normal de l’application.

### Assistant de première utilisation

Journées types, planning principal, éventuels plannings secondaires, objectif, report de départ et import historique.

### Notifications paramétrables

Vers 19 h, si une journée commencée est encore ouverte : actions envisagées « Je suis partie » et « Normal, j’y suis encore ». Ne pas harceler lorsque l’utilisatrice travaille réellement tard.

### Année N+1

Préparer un contenu administratif compréhensible à partir du bilan et des projections, sans recopier manuellement les chiffres. Séparer calcul, préparation du document et envoi. Le cahier des charges précis du mail N+1 reste à définir.

### Documents administratifs

Demandes de congés, récupérations, report N/N+1 et documents fondés sur les données déjà présentes. Ils restent modifiables et vérifiables avant utilisation.

### Export et sauvegarde

- export : CSV/Excel, journées, semaines, événements, remarques et synthèses ;
- sauvegarde : état restaurable complet pour changement ou perte de téléphone.

### PWA mobile

Accès direct depuis l’écran du téléphone, navigation basse, gros boutons, saisie rapide et comportement fiable après mise à jour.

## 12. Anomalies et travaux en cours

### Corrigés localement puis testés

- jeudi 17 septembre 2026 : divergence entre pause 30 min et NORJ 90 min ;
- Historique > Semaines arrêté à S35 : S36 et S37 sont maintenant reconstruites par le moteur commun ;
- duplication de l’éditeur de journée supprimée ;
- consommateurs vérifiés : Aujourd’hui, Historique, Années, compteurs et exports.
- jour prévu à 0 h et sans donnée réelle incorrectement affiché « À compléter » : son état commun est désormais « Validée » dès que sa date est atteinte ;
- Historique > Semaines : chaque semaine est désormais dépliable jusqu’aux journées et à leur éditeur.
- calendrier annuel : une semaine terminée ouvre désormais ses données réelles ; les journées manquantes sont signalées en rouge, tandis que le présent et le futur restent en mode planning prévu.
- anciennes consolidations : ressaisie progressive des journées et remplacement uniquement après validation explicite, avec archivage de l’ancien total.
- navigation de reconstitution : ajout d’événement depuis la journée et retour automatique à la semaine après enregistrement.
- solde de départ sans historique hebdomadaire : calcul et projection à partir de la référence, sans déficit annuel fictif.

### Pause et anciennes saisies de S36 — cause identifiée, décision d’attendre

L’écart de raccord de S36, observé d’abord à `-1h44` puis à `-3h54` après la correction NORJ, a pu être corrigé manuellement. Deux saisies anciennes en étaient la cause : une plage unique commencée l’après-midi conservait une pause prévue, et une journée découpée manuellement en plusieurs plages conservait également une pause en plus des coupures déjà exclues des plages.

Ces saisies avaient été faites avant que les demi-journées prévues et le multi-plage actuel existent. Ne pas ajouter pour l’instant de déduction automatique fondée sur un créneau de pause supposé : les journées types ne stockent que la durée de pause, pas son horaire, et une telle règle pourrait mal interpréter d’autres journées. Surveiller si le cas se reproduit avec les fonctions actuelles ; ne reprendre ce chantier que sur un exemple actuel reproductible.

Ne jamais masquer un futur écart de ce type par une régularisation, une constante ou un ajustement décoratif. Il faut démontrer sa provenance dans le code et les données actuels.

## 13. Tests

Avant publication :

```bash
node tests/regressions.js
```

Les tests couvrent actuellement :

- configuration NORJ à 90 min ;
- journée ancienne sans marqueur de personnalisation ;
- pause volontairement personnalisée ;
- pause certaine provenant d’un import ;
- travail après minuit ;
- continuité S35–S37 ;
- semaine passée incomplète ;
- jour prévu à 0 h mais réellement travaillé ;
- jour prévu à 0 h sans pointage automatiquement validé ;
- détail hebdomadaire dépliable avec accès à la modification des journées ;
- bascule réel/prévu lors de l’ouverture d’une semaine depuis le calendrier annuel ;
- absence de faux détail pour une semaine seulement consolidée ;
- maintien du total consolidé pendant une ressaisie partielle, comparaison avant remplacement et conservation de l’ancien total ;
- exercice partiellement inconnu couvert par un solde de référence, y compris semaine de raccord et PDF annuel ;
- conservation du contexte semaine lors de l’édition d’une journée et de son événement ;
- rattachement d’une semaine à son lundi ;
- cohérence de l’interface et des exports avec le moteur commun.

Vérifier également la syntaxe des scripts et `git diff --check`.

## 14. État au 20 septembre 2026

- dépôt : `lemlaurie-hub/mes-heures` ;
- base publiée avant cette correction : `main` au commit `f37a5a5fbaf9eb301d925988c2f66c6bfe352c9d` ;
- correction de l’état des jours à 0 h et détail dépliable des semaines préparés après cette base ;
- cache PWA préparé en version 56 ;
- les données réellement présentes sur le téléphone ne sont pas directement accessibles depuis le dépôt ; un export récent reste nécessaire pour diagnostiquer leur contenu exact.

Après chaque publication, mettre à jour cette section si les identifiants de commit ou l’état des anomalies ont changé.

## 15. Autorisation de maintenance de cette passation

Laurie autorise Léon à créer, modifier, committer et pousser `README_LEON.md` sans demander un accord explicite supplémentaire lorsque cela sert uniquement à conserver une nouvelle règle, décision, contrainte, anomalie ou information de passation liée à **Mes heures**.

Cette autorisation ne vaut pas automatiquement pour des modifications fonctionnelles ou architecturales de l’application sans rapport nécessaire avec la mise à jour documentaire.
