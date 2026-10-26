---
name: etincelle
description: >
  Étincelle — la réflexion de fond qui cherche l'idée que personne n'a eue, en français, pour
  inventer OU pour analyser : se démarquer, rentabiliser, innover, trouver une offre, un prix,
  un nom, une fonctionnalité phare, un canal de vente ; et passer au crible un existant (code,
  produit, UX, design, business, sécurité, exploitation) des projets Buyticle — Camille, kix,
  Snl / No Limit, Yoosfood, DIP, buyfacturation. Interroge d'abord, bannit les idées banales,
  provoque des connexions inattendues, fait s'affronter plusieurs rôles, chiffre la réalité,
  fait un pré-mortem, puis tranche : trois décisions dont une vraiment audacieuse, chacune
  avec un test à 0 FCFA cette semaine. À utiliser dès que l'utilisateur demande « quelle est
  la meilleure façon de… », « comment se démarquer / être rentable / innover », « réfléchis à
  fond », « brainstorm », « sois original », « analyse ce projet / ce code sous tous les
  angles », « qu'est-ce qu'on peut améliorer », ou hésite entre plusieurs directions — même
  sans prononcer le mot « brainstorming ».
---

# Étincelle

Le but : arriver à **trois décisions que l'utilisateur n'aurait jamais trouvées seul**, assez
originales pour le démarquer, assez solides pour survivre à la critique, assez concrètes pour
commencer lundi avec ses moyens réels.

Le piège à éviter, c'est la réponse de consultant : juste, raisonnable, interchangeable. Si une
idée aurait pu être écrite pour n'importe quelle entreprise de n'importe quel pays, elle n'a
pas sa place ici. L'originalité n'est pas un bonus : c'est ce qui fait gagner un petit acteur
face aux gros.

Deux modes, souvent mêlés :
- **Imaginer** : un objectif ouvert (« démarquer Camille », « rendre kix viral »).
- **Analyser l'existant** : un objet précis (dépôt, page, parcours, offre, grille de prix). On
  lit ce qui EST — pour de vrai — avant de proposer ce qui pourrait être.

## 0. Charger le contexte
Si le sujet touche Buyticle, Camille, kix, Snl, No Limit, Yoosfood ou le Cameroun, lis
`references/contexte-buyticle.md` en premier ; ne redemande rien de ce qu'il contient.
En mode Analyser, ouvre l'objet : fichiers clés, tests, dépendances, migrations, page en ligne,
documentation. Une analyse qui n'a pas ouvert les fichiers n'est qu'une opinion.

## 1. Interroger
Une idée brillante pour le mauvais objectif ne sert à rien. Identifie ce qui changerait
vraiment ta réponse et que tu ne peux pas déduire, puis demande-le avec `AskUserQuestion`
(2 à 4 questions par salve, options concrètes, ta recommandation marquée). Penses-y en priorité :
- **l'objectif chiffré** : combien, d'ici quand (un salaire visé, un nombre de clients…) — sans
  ce chiffre, le « calcul de réalité » de l'étape 5 est impossible ;
- **l'adversaire** : contre qui faut-il gagner (concurrents, habitudes, « je fais tout seul ») ;
- **les moyens** : temps, argent, compétences ;
- **les lignes rouges** : ce qu'il refuse ;
- **ce qui a déjà été tenté** ;
- en mode Analyser : **quel aspect** et **pour quel usage**.

Si l'utilisateur passe outre les questions, ne le relance pas : pose tes hypothèses en clair
(« je pars du principe que… ») et continue. Si une réponse ouvre une incertitude décisive en
cours de route, repose une question plutôt que de supposer.

## 2. Reformuler
Trois lignes : le problème réel, le critère de réussite mesurable, les contraintes. Si la
question posée n'est pas la bonne, dis-le — c'est souvent là que se cache la meilleure idée.

## 3. Le moteur d'originalité
C'est le cœur d'Étincelle. Fais-le vraiment, dans cet ordre.

**a. Vider le banal.** Écris d'abord, en une ligne chacune, les 5 à 8 idées qu'un concurrent
paresseux proposerait (« faire de la pub sur Facebook », « baisser les prix », « ajouter des
fonctionnalités », « faire des promotions »…). Elles sont désormais **interdites** sous cette
forme : on ne peut les réutiliser que retournées, radicalisées ou combinées à autre chose.
Montre la liste à l'utilisateur sous le titre « Ce qu'on s'interdit » — c'est aussi un
miroir de ce que fait la concurrence.

**b. Provoquer.** Applique au moins quatre des provocations de `references/provocations.md`
et nomme-les. Les plus fertiles :
- **Stimulus local au hasard** : tire 2 ou 3 éléments de la liste camerounaise (bendskin,
  tontine, call-box, marché Mboppi, maquis…) et force une connexion avec le sujet.
- **Emprunt lointain** : que ferait ici le football, un jeu vidéo, une église, une banque
  mobile, un griot ?
- **Renversements** : le client devient vendeur, le gratuit devient cher, l'outil devient un
  service, le produit disparaît.
- **Rétro-futur** : « En 2030, Camille a gagné. Que s'est-il passé ? » puis remonter jusqu'à
  aujourd'hui.
- **Contrainte absurde** : 7 jours, 0 FCFA, sans écran, sans IA, sans internet.

**c. Passer au crible tous les angles** de `references/angles.md` : au moins une idée ou un
constat par angle pertinent, y compris ceux qui semblent hors sujet.

**d. Combiner.** Prends deux idées moyennes et fais-en une forte. Les meilleures idées
originales sont souvent des combinaisons improbables d'éléments ordinaires.

## 4. Faire s'affronter les rôles
Fais réagir, en quelques lignes franches chacun, aux idées les plus prometteuses :
1. **le commerçant** qui paie et n'a pas de temps ;
2. **son client final**, téléphone d'entrée de gamme, data chère ;
3. **le financier** : marge, trésorerie, coût d'acquisition ;
4. **le designer** : beauté, émotion, effet « waouh » ;
5. **l'ingénieur** : faisabilité, dette, sécurité, coût d'exploitation ;
6. **le concurrent** qui veut copier ou écraser ;
7. **le régulateur / Meta** : règles WhatsApp, données, conformité ;
8. **le provocateur** : il trouve tout trop sage et pousse une idée deux crans plus loin.

Une voix qui approuve n'apporte rien : chacune cherche la faille ou la surenchère.

## 5. Calcul de réalité
Mets des chiffres, même approximatifs, sur l'objectif : combien de clients, à quel prix, quel
coût, quel délai, quel temps du fondateur. Ce calcul tue souvent une piste « évidente » (40
petits clients en 10 semaines, seul) et en révèle une autre (3 gros clients). Montre-le en un
petit tableau ; annonce les hypothèses.

## 6. Pré-mortem et test du copieur
Pour les 3 à 5 meilleures idées :
- **pré-mortem** : « Dans un an, c'est un échec. Pourquoi ? » — causes et parades ;
- **test du copieur** : un concurrent peut-il la copier en un mois ? Si oui, qu'est-ce qui la
  rendrait inimitable (données, réseau, relation, savoir-faire, marque) ?

Une idée qui ne survit pas est retirée ou transformée ; dis-le explicitement.

## 7. Converger et trancher
Note de 1 à 5 : **Impact**, **Coût** (5 = très peu cher), **Délai** (5 = rapide), **Risque**
(5 = peu risqué), **Originalité**, **Alignement** avec les moyens. Tableau trié, total à droite.

Retiens **trois décisions** :
- une **victoire rapide** (cette semaine, effet visible) ;
- un **pari structurant** (change la trajectoire en 3 à 6 mois) ;
- une **audace** (originalité 5/5, peut-être risquée — c'est elle qui fait parler de toi).

Pour chacune : pourquoi elle, le **test à 0 FCFA (ou presque) cette semaine** (qui, quoi, comment
mesurer), l'indicateur de succès, le seuil d'abandon. Un test bon marché d'abord, le
développement ensuite : on ne code pas une idée avant qu'un vrai client ait dit oui.

## Mode Analyser — en plus
Avant les idées, un **état des lieux** aspect par aspect (partie « Analyse de l'existant » de
`references/angles.md`) : solide / fragile / manquant, avec preuve (`fichier:ligne`, URL, écran),
classé bloquant / important / confort. Cherche aussi **ce qui est déjà original et sous-exploité**
dans l'existant : la meilleure innovation est souvent un atout qu'on cache.

## Format de sortie
```
# [Sujet]
## En une phrase              ← la recommandation, d'emblée
## Le vrai problème           ← reformulation + hypothèses
## État des lieux             ← mode Analyser uniquement
## Ce qu'on s'interdit        ← les idées banales bannies
## Les étincelles             ← idées par angle et par provocation (provocation nommée)
## Ce qu'en disent les rôles
## Calcul de réalité          ← petit tableau chiffré
## Pré-mortem et test du copieur
## Grille de décision
## Les trois décisions        ← victoire rapide / pari / audace, chacune avec son test à 0 FCFA
## Questions ouvertes
```
Phrases courtes, prix en FCFA, aucun jargon non expliqué. Si le résultat mérite d'être gardé,
propose de l'enregistrer dans `docs/reflexions/AAAA-MM-JJ-sujet.md` du dépôt concerné.

## À éviter
- Une idée réutilisable telle quelle par n'importe qui, n'importe où.
- Une idée qui suppose des moyens absents, sans le dire.
- Cartographier sans trancher.
- Promettre ce que Meta, les opérateurs ou Mobile Money ne garantissent pas.
