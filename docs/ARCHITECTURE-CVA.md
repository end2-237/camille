# CVA — Comprendre · Vérifier · Agir

**L'architecture de l'agent-vendeur ancré de Camille.**

Version du document : 1.0 — correspond au workflow `Camille_N2_Restaurant_v31`.
Ce fichier est le point de référence. On le relit, on le conteste et on
l'amende chaque jour ; la section « Failles connues » est faite pour être
raturée.

---

## 1. Le problème que CVA résout

Un agent WhatsApp de commerce doit tenir deux promesses qui se contredisent.

Il doit **parler comme un humain** — comprendre l'argot, les fautes, deux
demandes dans une phrase, une information donnée trois messages plus tôt. Seul
un modèle de langue sait faire ça.

Il doit **ne jamais mentir** — pas un prix inventé, pas un produit qui
n'existe pas, pas une commande annoncée mais non enregistrée. Un modèle de
langue, seul, ne sait pas garantir ça.

Les deux architectures naïves échouent chacune d'un côté. Tout confier au
modèle donne un vendeur charmant qui invente des prix. Tout confier au code
donne un serveur vocal déguisé — c'est ce qu'était Camille avant : **59
branches `if(intent === …)`** qui réagissaient au premier mot-clé rencontré.

CVA répartit les rôles au lieu de choisir un camp :

> **Le modèle comprend et parle. Le code vérifie et exécute.**
> **Aucun des deux ne fait le travail de l'autre.**

---

## 2. Les cinq objectifs, et comment chacun est atteint

### Objectif 1 — Comprendre avant de répondre

**Ce qu'on veut.** Que l'agent lise le message entier avant de décider, et non
son premier mot-clé. « Je voulais commander hier mais la livraison était trop
chère, vous avez quoi d'autre ? » est une demande de catalogue.

**Comment c'est atteint.**

1. Le modèle reçoit une consigne de raisonnement explicite et renvoie, **avant
   sa réponse**, une analyse : `analyse`, `certitude` (0-100), `ambigu`,
   `demandes[]` (une entrée par demande distincte), `incompris` (le fragment
   obscur, mot pour mot).
2. Règle de la **dernière clause** : quand un message contient plusieurs
   propositions, la demande réelle est la dernière formulée. Le code découpe
   sur `mais`, `sinon`, `par contre`, `au fait`, `finalement`, les virgules et
   les points d'interrogation, puis relit les mots-clés de sujet sur ce seul
   segment.
3. Cette règle **tranche** : si la dernière clause demande visiblement autre
   chose, elle l'emporte, y compris contre le classement du modèle.

**Vérifiable par.** Cas 13 à 17 de la suite de référence.

---

### Objectif 2 — Ne jamais inventer

**Ce qu'on veut.** Zéro hallucination sur les prix, les produits, les lieux,
les délais.

**Comment c'est atteint.** L'ancrage s'applique à deux niveaux.

*Sur le produit.* Le nom proposé par le modèle est confronté au catalogue
réel. S'il n'existe pas, la référence est corrigée ou refusée.

*Sur la phrase.* `phraseAncree()` extrait tous les nombres de la réponse et
vérifie qu'ils appartiennent aux faits connus — prix, prix max, stock, frais
de livraison, délai, quantités du panier, **et les nombres écrits par le
client lui-même**. Un chiffre inventé disqualifie la phrase, qui est alors
remplacée par une formulation composée depuis la base.

Trois garde-fous complètent le dispositif :

- une phrase qui nomme un produit **différent** de la fiche jointe est retirée
  (le code possède la vérité du catalogue) ;
- un tarif absent n'est jamais un tarif nul — `Number(null) === 0` a longtemps
  fait annoncer « la livraison est à 0 XAF » ;
- une URL d'image doit être une URL absolue `http(s)` pour entrer dans un
  album ; une seule mauvaise valeur faisait rejeter l'album entier par WAHA.

---

### Objectif 3 — Agir, ou demander. Jamais autre chose.

**Ce qu'on veut.** Trois sorties possibles, jamais une quatrième. Répondre à
côté est pire que d'avouer.

**Comment c'est atteint.**

| Situation | Sortie |
|---|---|
| L'agent a compris | il agit, et il le dit |
| Il hésite | il reformule **avec les mots du client**, propose ce qui existe, demande |
| Il ne comprend pas | il **nomme la zone d'ombre** et demande |

La **garde de clarification** interdit toute action irréversible sur une
supposition : quand le modèle se déclare ambigu ou sous 70 de certitude, les
intentions mutantes (`cart_add`, `cart_validate`, `order_intent`…) deviennent
`clarifier`. Une fiche produit se corrige d'un mot ; un panier modifié, non.

Deux exceptions bornent cette garde :

- **jamais pendant le tunnel de commande** — il est déterministe et le modèle
  n'en voit pas l'état ;
- **jamais quand l'ancrage a trouvé un produit exact** — là, le code sait
  mieux que le modèle.

La reformulation suit quatre temps, dans cet ordre : *je répète ton mot* →
*je dis franchement si je l'ai* → *je ramène vers ce qui existe, en disant
pourquoi* → *je demande, sans rien engager*.

---

### Objectif 4 — Une seule voix

**Ce qu'on veut.** Que le client ne sente jamais le passage du vendeur à la
machine.

**Comment c'est atteint.** La phrase du modèle est la réponse **par défaut**.
Le code n'intervient que si elle n'est pas ancrée. Quand elle tient debout,
elle sort seule ; les fiches et albums sont des **pièces jointes**, pas des
remplacements.

Les gabarits existent toujours, mais uniquement comme **filet** : ils ne
servent que les tours où le modèle est muet, et ils sont écrits pour parler,
pas pour remplir un formulaire.

Le modèle reçoit également ce que le code sait et que lui ignore — c'est le
bloc `## LA SITUATION` :

```
Il est 11h04 (matin).
C'est un habitué (7 messages échangés).
Panier : 1 x Cheddar Frites.
Il a une commande en cours (n° VUT346, en_cours).
Il regarde la catégorie burger — on a aussi : Cheddar Burger.
Il s'appelle Dave. Il a déjà commandé 4 fois chez nous.
IMPORTANT — il t'a posé cette question et tu n'y as pas encore répondu : « … »
```

Ce sont des **faits, pas un script**. « Je sens que tu as envie de gras
aujourd'hui » devient alors une phrase que le modèle écrit lui-même, différente
à chaque fois, parce qu'elle découle d'un fait réel.

---

### Objectif 5 — Ne jamais s'arrêter

**Ce qu'on veut.** Un client ne doit jamais voir une panne.

**Comment c'est atteint.** Quatre lignes de défense successives.

1. **L'économie** — quand la réponse est certaine (salutation seule,
   remerciement, carte, nom de produit écrit exactement), la réponse est
   fabriquée sur place et le modèle n'est pas appelé. Le quota est gardé pour
   les messages difficiles. Le raccourci est **interdit** pendant une commande
   en cours.
2. **La reprise** — sur échec, une pause de trois secondes précède la seconde
   tentative, au lieu de retomber instantanément sur le même quota saturé.
3. **La dégradation utile** — modèle muet : l'ancrage répond seul. Produit
   identifié → sa fiche. Demande de vitrine → le catalogue. Infos boutique →
   composées depuis la base. Sinon → un aveu honnête, jamais une réponse à
   côté.
4. **Le silence sur la panne** — aucun message technique ne peut atteindre le
   client. `llm_ok` est le seul juge ; un 429 ne devient jamais une phrase.

---

## 3. Le flux, nœud par nœud

```
WhatsApp (WAHA)
   │
   ├─ 1. INGESTION ─────────────────────────────────────────────
   │   WAHA Webhook → Filter Valid Messages → Extract Fields
   │   anti-groupes, anti-boucle, texte + position + média + citation
   │
   ├─ 2. ÉTAT & DONNÉES ────────────────────────────────────────
   │   Get Agent by Session → Check Contact → Humain en cours ?
   │   → New & Welcome? → Check Quota → Get Last Order
   │   → Get History (10 tours)
   │
   ├─ 3. RECHERCHE ─────────────────────────────────────────────
   │   Search Query → Search Catalogue → Catalogue Highlights
   │
   ├─ 4. COGNITION ─────────────────────────────────────────────
   │   Build Prompt  (catalogue + situation + consignes)
   │      └→ Faut-il le modèle ?  ──non──→ Réponse directe ──┐
   │             │oui                                        │
   │             ↓                                           │
   │         Groq LLM (kimi-k2)                              │
   │             └─ Groq OK ? ──non──→ Respirer (3 s)        │
   │                     │                  └→ Groq Fallback │
   │                     ↓                          ↓        │
   │                  Extract Response ←────────────┴────────┘
   │
   ├─ 5. ARBITRAGE ─────────────────────────────────────────────
   │   Ancrage — priorités T1 > T2 > T3, garde de clarification,
   │             dossier `besoin`, mémoire des questions posées
   │
   └─ 6. EXÉCUTION & PAROLE ────────────────────────────────────
       Build Reply → Save Conversation → Record Usage → Trace
                   → Send (texte | fiche | album | position | commande)
```

**70 nœuds.** Les deux qui décident sont `Ancrage` (25 Ko) et `Build Reply`
(56 Ko).

### Les trois étages de priorité de l'Ancrage

Cet ordre est la correction la plus structurante de toute la refonte : deux
cascades indépendantes coexistaient, et la seconde écrasait silencieusement la
première, y compris les états de commande.

| Étage | Contenu | Ne peut jamais être écrasé par |
|---|---|---|
| **T1** | changement de nom, tunnel de commande, opérations de panier fermes | T2, T3 |
| **T2** | mots-clés de sujet explicites (livraison, paiement, promo…) | T3 |
| **T3** | déductions faibles (« je veux X », un nom de plat reconnu) | — |

### La mémoire

L'état voyage dans un marqueur `[[state:…]]` accolé au message assistant, isolé
par `session + téléphone`. Il porte :

`focus` · `cart` · `pref` · `co` (étape du tunnel) · `cust` · `pend` ·
`att` (question posée en attente de réponse) · `besoin` (dossier cumulatif :
produit + quartier) · `pq` (question du client restée sans réponse) ·
`rates` (échecs consécutifs, pour le relais humain).

Le **dossier `besoin`** est ce qui fait la différence entre « répondre à des
messages » et « suivre une conversation » : ce que le client veut et où il le
veut s'accumulent au fil des tours et ne s'effacent pas.

---

## 4. Ce que le code garde jalousement

Le modèle ne pilote **jamais** :

- le tunnel de commande (nom → adresse → confirmation → création) ;
- l'arithmétique du panier et les totaux ;
- la création de la commande en base ;
- les quotas et l'expiration d'abonnement ;
- la reprise humaine.

Ce sont des invariants. Un modèle qui saute une étape une fois sur cent, c'est
une vraie commande perdue chez un vrai marchand, ce jour-là.

---

## 5. Comment on éprouve tout ça

Un banc d'essai autonome — **un seul fichier HTML** qui embarque le workflow
entier et exécute le **vrai code** des nœuds `Ancrage` et `Build Reply` hors de
n8n. Ni WhatsApp, ni Groq, aucun jeton consommé.

Il couvre :

- **56 cas de référence**, dont 7 conversations multi-tours — un défaut de
  mémoire est structurellement invisible sur un message isolé ;
- la simulation de la couche 1 (intention, certitude, facette, zone d'ombre,
  phrase du modèle) ;
- un interrupteur **« panne du LLM »** pour éprouver la dégradation sans
  attendre un vrai 429 ;
- un bouton d'export du JSON à importer dans n8n — le workflow et ses tests ne
  peuvent pas se désynchroniser, c'est le même fichier.

**Règle de travail.** Un client se plaint → sa phrase exacte devient un cas.
Si ça reproduit, le défaut est dans la logique. Sinon, il vient du modèle ou
du catalogue réel — et on sait où chercher.

---

## 6. Ce qui est mesuré

Table `camille.conversation_traces`, une ligne par tour :

`user_msg` · `search_q` · `llm_intent` · `final_intent` · `corrected` ·
`resolved_product` · `reply_mode` · `items` · `tokens` · `latency_ms` ·
`raisonnement` · `certitude` · `ambigu` · `raccourci`

Les quatre dernières sont la mesure de CVA lui-même :

- `raisonnement` vide + `llm_intent` rempli → le modèle n'a pas répondu ;
- `raccourci` rempli → aucun appel n'a eu lieu, et c'était voulu ;
- `ambigu` → l'agent a préféré demander ; trop rare, la garde ne sert à rien,
  trop fréquent, elle fatigue le client ;
- `llm_intent ≠ final_intent` → le code a corrigé le modèle. Un taux qui monte
  signale une consigne à revoir, pas un correctif à ajouter.

---

## 7. Failles connues, au 9 août 2026

*Par ordre d'impact. Cette section est faite pour être raturée.*

1. **Disponibilité du modèle.** Une clé Groq gratuite, 429 quasi permanent. Ce
   qu'on teste alors n'est pas CVA, c'est son filet. Tout le reste est
   théorique tant que ce point tient.
2. **Le choix dans une liste au lieu d'une décision.** 59 branches
   `if(intent === …)` subsistent. La couche d'actions — huit outils, le tunnel
   laissé déterministe — est conçue mais pas construite.
3. **Données marchand manquantes.** Frais de livraison, zones, horaires ne sont
   pas obligatoires à la création d'un agent. Un agent amputé dès le premier
   jour.
4. **Aucune mémoire entre les conversations.** Le prénom et l'historique
   d'achat sont injectés (v31), mais rien ne survit à la fenêtre de 10 tours.
5. **Secrets en dur.** La clé Groq figure en clair dans deux nœuds HTTP. À
   déplacer vers `$env.GROQ_API_KEY` — **variable d'abord, workflow ensuite**,
   sinon tout s'arrête.
6. **Une seule langue.** Ni anglais ni pidgin, alors que les deux sont courants
   à Douala.
7. **Les vocaux ne sont pas entendus.** Filtrés, jamais transcrits.
8. **N1 et N2 Catalogue n'ont rien de tout ça.** CVA n'existe que sur N2
   Restaurant.
9. **Pas de mesure automatique de la qualité.** Les colonnes existent, personne
   ne les lit. Il manque un relevé hebdomadaire.

---

## 8. Historique des décisions structurantes

| Version | Décision |
|---|---|
| v14 | Le workflow décide au lieu de réagir — verdicts *sûr / deviné / plusieurs / aucun* |
| v15 | Trois étages de priorité ; une question n'est plus prise pour un nom |
| v16 | Les trois couches : décodage, exécution, clarification |
| v17 | La règle de dernière clause tranche, au lieu de seulement s'abstenir |
| v19 | La livraison passe par la couche cognitive : où / quand / combien |
| v20 | La phrase du modèle passe en premier ; l'agent retient sa propre question |
| v21 | Une pièce jointe illustre une réponse, elle ne la remplace plus |
| v22 | Un message d'exploitation n'est jamais une réponse ; prompt allégé de 19 % |
| v23 | Reformulation en quatre temps, avec les mots du client |
| v24 | Le code décide, le modèle parle — le gabarit redevient un filet |
| v25 | Le filet cesse de répondre à côté |
| v26 | Une vraie seconde chance pour le modèle ; un souvenir ne masque plus une question |
| v27 | Le dossier `besoin` : accumuler, vérifier, puis répondre |
| v28 | Un verbe n'est jamais un produit ; historique porté à 10 tours |
| v29 | L'évident ne consomme plus d'appel ; sortie ramenée à 400 jetons |
| v30 | Le bloc `## LA SITUATION` — donner au modèle ce que le code sait |
| v31 | Promesse tenue, relais humain spontané, client reconnu, albums valides |
