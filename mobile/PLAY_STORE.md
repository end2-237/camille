# Première release Play Store — Camille

Tout ce qui doit être saisi dans la Play Console, prêt à copier.
Les éléments légaux viennent du papier en-tête officiel de BUYTICLE ETS.

---

## 1. Identité du développeur

| Champ | Valeur |
|---|---|
| Raison sociale | **BUYTICLE ETS** |
| N° RCCM | CM-DLA-01-2025-A10-01482 |
| Date de création | 17 juin 2025 |
| Adresse | Bonamoussadi, Douala — Cameroun |
| Téléphone | (+237) 696 99 58 79 |
| E-mail de contact | contact@buyticle.com |
| Site web | https://camille.vps.buyticle.com |

> Prendre un compte développeur **organisation**, pas personnel : c'est le nom
> d'ETS BUYTICLE qui doit apparaître sur la fiche. La vérification demande un
> numéro D-U-N-S et prend plusieurs jours — à lancer en premier, c'est le plus
> long. Un compte organisation dispense aussi de l'obligation des 12 testeurs
> pendant 14 jours qui frappe les comptes personnels récents.

---

## 2. Fiche du magasin

**Nom de l'application** (30 caractères max)

```
Camille — Vendeur WhatsApp
```

**Description courte** (80 caractères max)

```
Votre vendeur IA sur WhatsApp : répond, prend les commandes, vous les livre.
```

**Description complète** (4000 caractères max)

```
Camille répond à vos clients sur WhatsApp, présente vos produits, prend les
commandes et vous les remet prêtes à préparer. Vous gardez votre numéro, vos
clients gardent leurs habitudes.

CE QUE FAIT CAMILLE POUR VOUS

• Répond en français, jour et nuit, même quand vous dormez
• Présente vos produits avec photos, prix et disponibilité
• Comprend « 2 nuggets et 1 burger » et construit le panier tout seul
• Demande la position du client et calcule les frais selon le quartier
• Enregistre la commande et vous prévient aussitôt sur votre téléphone
• Envoie au client son accusé de réception, puis son bon de commande

DANS L'APPLICATION

• Vos commandes en direct : à traiter, en traitement, livrée
• L'itinéraire vers le client, avec sa position exacte
• Votre catalogue : ajout de produits, photos, prix, stock
• Le chiffre d'affaires généré par vos commandes
• Vos conversations WhatsApp, lisibles à tout moment
• Une alerte à chaque nouvelle commande

POUR QUI

Restaurants, boutiques de mode, cosmétiques, électronique, prestataires de
services. Camille s'adapte à votre métier : un restaurant reçoit une carte du
menu, une boutique reçoit un catalogue.

VOTRE SITE AUSSI

Si vous avez un site web, il peut afficher le même catalogue et envoyer ses
commandes au même endroit. Une seule saisie de produits, deux canaux de vente.

ESSAI GRATUIT

14 jours pour essayer, sans engagement.

BUYTICLE ETS — Douala, Cameroun
```

---

## 3. Ressources graphiques

| Élément | Format | État |
|---|---|---|
| Icône | 512×512 PNG, sans transparence | ✅ `mobile/store/icon-512.png` |
| Bannière | 1024×500 PNG | ✅ `mobile/store/feature-graphic-1024x500.png` |
| Captures téléphone | 2 minimum, 16:9 ou 9:16, min 320 px | **à prendre sur ton téléphone** |

Captures suggérées, dans cet ordre : le tableau de bord avec le chiffre
d'affaires, la liste des commandes, le détail d'une commande avec l'itinéraire,
le catalogue, une conversation WhatsApp.

---

## 4. Sécurité des données

À déclarer — la fiche doit correspondre à la politique de confidentialité,
Google recoupe les deux et refuse en cas d'écart.

| Donnée | Collectée | Partagée | Raison |
|---|---|---|---|
| Nom, e-mail | oui | non | Compte utilisateur |
| Numéro de téléphone | oui | non | Compte et contact WhatsApp |
| **Position précise** | oui | non | Coordonnées de livraison partagées par le client |
| **Identifiants d'appareil** | oui | non | Jeton Firebase pour les notifications |
| Messages | oui | non | Conversations traitées par l'agent |

Cocher également :
- Les données sont **chiffrées en transit** — oui
- L'utilisateur peut **demander leur suppression** — oui, https://camille.vps.buyticle.com/supprimer-compte

---

## 5. URL à déclarer

| Champ | URL |
|---|---|
| Politique de confidentialité | https://camille.vps.buyticle.com/privacy |
| Suppression de compte | https://camille.vps.buyticle.com/supprimer-compte |
| Conditions d'utilisation | https://camille.vps.buyticle.com/terms |

---

## 6. Accès pour les relecteurs

L'application exige une connexion : sans identifiants, Google rejette pour
« impossible d'évaluer l'application ».

Le compte de démonstration se monte en une commande, depuis la racine du dépôt :

```bash
node scripts/seed-demo-account.mjs
```

Le script crée le compte, un restaurant de démonstration (« Chez Mado »),
7 produits et 3 commandes, puis affiche les identifiants. Il est rejouable :
relancé, il complète ce qui manque au lieu d'échouer.

**À saisir dans Play Console → Contenu de l'app → Accès à l'application :**

| Champ | Valeur |
|---|---|
| Nom d'utilisateur | `demo.play@buyticle.com` |
| Mot de passe | `CamilleDemo2026!` |

**Instructions pour le relecteur** (à recopier dans le champ prévu) :

```
Se connecter avec les identifiants fournis. Le compte contient un restaurant
de démonstration, son catalogue et des commandes.

La connexion d'un compte WhatsApp n'est PAS nécessaire pour évaluer
l'application. Les écrans Commandes et Catalogue sont consultables
immédiatement depuis la barre de navigation en bas.
```

> Le tableau de bord affiche les statistiques de messages, qui restent à zéro
> tant qu'aucun WhatsApp n'est connecté. C'est pourquoi les instructions
> ci-dessus orientent le relecteur vers **Commandes** et **Catalogue**, qui
> sont peuplés.

> Ce compte ne contient aucune donnée réelle et son mot de passe est destiné à
> être communiqué à Google. Ne jamais y mettre de vraies commandes, et ne pas
> réutiliser ce mot de passe ailleurs.

---

## 7. Questionnaires obligatoires

- **Classification du contenu** : application professionnelle, aucun contenu
  sensible.
- **Public cible** : 18 ans et plus. Ne pas cocher « enfants » — cela
  déclencherait des obligations bien plus lourdes.
- **Application financière** : non.
- **Publicités** : non.

---

## 8. Build

```bash
# Le workflow GitHub produit l'AAB signé
gh workflow run build-mobile.yml
```

Secrets requis sur le dépôt (Settings → Secrets → Actions) :

| Secret | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | le keystore encodé : `base64 -w0 camille-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | alias de la clé (défaut `camille`) |
| `ANDROID_KEY_PASSWORD` | mot de passe de la clé (défaut : celui du keystore) |

Sans `ANDROID_KEYSTORE_BASE64`, le build ne s'arrête pas : il retombe sur la
clé de debug et **ne produit aucun AAB**. C'est voulu — un fork ne doit pas
casser — mais cela veut dire qu'un AAB absent signifie « secret manquant »,
pas « build cassé ».

Vérifications avant envoi :

- `versionCode` = 1 pour la première release, à incrémenter à chaque envoi
- `targetSdkVersion` = 35 (configuré via `expo-build-properties`)
- **Confirmer le niveau exigé dans la Play Console** : Google le relève chaque
  année en août. Si la console réclame 36, changer la valeur dans `app.json`.
- Conserver le keystore **et** ses mots de passe hors du dépôt : perdus, la mise
  à jour de l'application devient impossible, définitivement.
