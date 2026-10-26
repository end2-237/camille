---
name: reflexion-profonde
description: >
  Réflexion de fond, en français, pour inventer OU pour analyser : brainstorming stratégique
  (rentabiliser, innover, se démarquer, trouver un modèle économique, une offre, un nom, une
  fonctionnalité phare) et audit complet de l'existant (code, produit, UX, design, business,
  sécurité, exploitation) des projets Buyticle — Camille, kix, Snl / No Limit, Yoosfood, DIP,
  buyfacturation. Pose les questions qui manquent avant de répondre, passe le sujet au crible
  de tous les angles, joue plusieurs rôles contradictoires, fait un pré-mortem, puis tranche
  avec une grille de notes et trois décisions applicables cette semaine. À utiliser dès que
  l'utilisateur demande « quelle est la meilleure façon de… », « comment rendre X innovant /
  rentable / supérieur », « réfléchis à fond », « brainstorm », « analyse ce projet / ce code /
  cette page sous tous les angles », « qu'est-ce qu'on peut améliorer », ou hésite entre
  plusieurs directions — même s'il ne prononce pas le mot « brainstorming ».
---

# Réflexion profonde

Le but n'est pas de produire *beaucoup* d'idées, mais d'arriver à **trois décisions que
l'utilisateur n'aurait pas trouvées seul**, solides parce qu'elles ont survécu à la critique,
et faisables avec ses moyens réels. Une réponse « raisonnable » qu'un consultant générique
aurait donnée est un échec : chaque idée doit être ancrée dans le contexte concret du projet.

Deux modes, souvent mêlés :

- **Imaginer** : un objectif ouvert (« rentabiliser Camille », « rendre kix viral »).
- **Analyser l'existant** : un objet précis (un dépôt, une page, un parcours, une offre, un
  fichier de prix). On part de ce qui EST, lu pour de vrai, avant de proposer ce qui pourrait être.

## Étape 0 — Charger le contexte

Si le sujet touche Buyticle, Camille, kix, Snl, No Limit, Yoosfood ou le Cameroun, lis
`references/contexte-buyticle.md` avant toute chose : il contient le marché, les clients,
les prix, les contraintes et les leçons déjà apprises. Ne redemande jamais ce qui y figure.

En mode **Analyser**, lis l'objet lui-même : le code (structure du dépôt, fichiers clés, tests,
dépendances, migrations), la page en ligne si elle est accessible, la documentation existante.
Une analyse qui n'a pas ouvert les fichiers n'est qu'une opinion.

## Étape 1 — Interroger (ne pas sauter)

Une idée brillante pour le mauvais objectif ne sert à rien. Avant de diverger, identifie ce qui
changerait réellement ta réponse et que tu ne peux pas déduire du contexte, puis pose ces
questions avec l'outil `AskUserQuestion` (jusqu'à 4 par appel, options concrètes, une
recommandation marquée quand tu en as une). Typiquement :

- **Le vrai objectif** derrière la demande : « rentabiliser » = plus de clients ? prix plus
  élevé ? moins de coûts ? moins de départs ? dans quel délai ?
- **L'horizon et l'ambition** : survie du mois, croissance sur 6 mois, pari à 2 ans ?
- **Les moyens** : temps disponible, argent mobilisable, compétences, personnes.
- **Les lignes rouges** : ce qu'il refuse (lever des fonds, embaucher, changer de cible, etc.).
- **Ce qui a déjà été essayé** et pourquoi ça n'a pas marché.
- En mode Analyser : **sur quoi porter l'effort** (tout, ou un aspect prioritaire) et **pour
  quel usage** (décider, corriger, présenter à un client, lever des fonds).

Pose une seule salve au départ (2 à 4 questions). Si une réponse ouvre une nouvelle
incertitude décisive, repose une question en cours de route plutôt que de supposer. Mais ne
transforme pas la séance en interrogatoire : ce que le contexte ou le bon sens tranche, tu le
tranches et tu l'annonces (« je pars du principe que… »).

## Étape 2 — Reformuler

En trois lignes : le problème réel, le critère de réussite mesurable, les contraintes. Si la
reformulation révèle que la question posée n'est pas la bonne (« tu demandes comment vendre
plus cher, mais le vrai frein semble être la confiance »), dis-le — c'est souvent là que se
trouve la meilleure idée.

## Étape 3 — Diverger sous tous les angles

Passe le sujet au crible de **chaque** angle de `references/angles.md` qui s'applique (la
plupart s'appliquent). Pour chaque angle, au moins une idée ou un constat — y compris quand
l'angle semble hors sujet : c'est précisément là que naissent les idées originales.

Pour sortir des évidences, applique au moins trois des techniques suivantes et dis lesquelles :

- **Premiers principes** : de quoi le problème est-il fait, une fois les habitudes retirées ?
- **Inversion** : comment garantir l'échec ? Puis faire l'inverse.
- **Emprunt** : qui a résolu un problème analogue dans un autre secteur ou un autre pays
  (tontine, mototaxi, Mobile Money, Uber, Duolingo…) et que peut-on lui prendre ?
- **10× plutôt que 10 %** : que faudrait-il pour être dix fois meilleur, pas un peu ?
- **Contrainte forcée** : et si c'était gratuit ? sans IA ? sans internet ? en 7 jours ?
- **Jobs To Be Done** : pour quel « travail » le client « embauche »-t-il vraiment le produit ?
- **Combiner** deux idées faibles en une forte.

## Étape 4 — Faire parler les rôles

Dans la même réponse, fais réagir successivement ces voix aux idées les plus prometteuses
(quelques lignes chacune, franches, sans politesse inutile) :

1. **Le commerçant camerounais** qui paie et n'a pas de temps à perdre.
2. **Son client final** sur WhatsApp, avec un téléphone d'entrée de gamme et peu de data.
3. **Le financier** : marge, trésorerie, coût d'acquisition, délai de retour.
4. **Le designer** : beauté, émotion, simplicité, effet « waouh ».
5. **L'ingénieur** : faisabilité, dette technique, sécurité, coût d'exploitation.
6. **Le concurrent** qui veut copier ou écraser l'idée.
7. **Le régulateur / Meta** : règles WhatsApp, protection des données, conformité.

Une voix qui se contente d'approuver n'apporte rien : chacune cherche ce qui cloche de son point de vue.

## Étape 5 — Pré-mortem

Pour les 3 à 5 meilleures idées : « Nous sommes dans un an, c'est un échec. Pourquoi ? ».
Note les causes plausibles et ce qui les préviendrait. Une idée qui ne survit pas à son
pré-mortem est retirée ou transformée — dis-le explicitement.

## Étape 6 — Converger

Note les idées survivantes de 1 à 5 sur : **Impact**, **Coût** (5 = très peu cher),
**Délai** (5 = rapide), **Risque** (5 = peu risqué), **Originalité**, **Alignement** avec les
moyens réels. Présente la grille en tableau, total à droite, triée.

Retiens **trois décisions** :
- une **victoire rapide** (faisable cette semaine, effet visible),
- un **pari structurant** (change la trajectoire sur 3 à 6 mois),
- une **audace** (originale, peut-être risquée, mais qui démarque vraiment).

Pour chacune : pourquoi elle, le **premier pas concret cette semaine** (qui, quoi, combien),
l'indicateur qui dira si ça marche, et le seuil d'abandon.

## Mode Analyser — ce qu'on regarde en plus

Quand l'objet est un existant, produis d'abord un **état des lieux** avant les idées, aspect
par aspect (voir la partie « Analyse de l'existant » de `references/angles.md`) : ce qui est
solide, ce qui est fragile, ce qui manque, avec références précises (`fichier:ligne`, URL,
écran). Classe les constats par gravité (bloquant / important / confort). Ne propose une
réécriture que si le constat la justifie ; préfère les corrections ciblées.

## Format de sortie

Utilise ce gabarit (titres conservés, contenu adapté ; un mode Analyser ajoute « État des lieux ») :

```
# [Sujet]
## En une phrase          ← la recommandation principale, d'emblée
## Le vrai problème       ← reformulation + hypothèses posées
## État des lieux         ← mode Analyser uniquement
## Idées par angle        ← regroupées, les plus fortes en premier
## Ce qu'en disent les rôles
## Pré-mortem
## Grille de décision     ← tableau noté
## Les trois décisions    ← victoire rapide / pari / audace, avec premier pas et indicateur
## Questions ouvertes     ← ce qu'il faudrait vérifier ou décider ensuite
```

Écris pour un fondateur pressé : phrases courtes, chiffres en FCFA quand c'est un prix,
aucun jargon non expliqué. Si le résultat mérite d'être conservé, propose de l'enregistrer dans
`docs/reflexions/AAAA-MM-JJ-sujet.md` du dépôt concerné.

## Ce qu'il faut éviter

- Les listes génériques (« améliorer le marketing », « utiliser les réseaux sociaux ») : toute
  idée doit être assez précise pour être commencée lundi.
- Les idées qui supposent des moyens que l'utilisateur n'a pas, sans le signaler.
- Conclure sans trancher : le but est de décider, pas de cartographier.
- Promettre ce que les plateformes ne garantissent pas (Meta, Mobile Money, opérateurs).
