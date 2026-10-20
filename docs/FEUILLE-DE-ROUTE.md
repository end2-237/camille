# Feuille de route de Camille — MVP

> Décidée le 20 octobre 2026. À relire au début de chaque session de travail.
> Le paiement en ligne (agrégateur, carte) est **volontairement écarté** : trop compliqué au Cameroun pour le MVP.

## Où on en est

- **App review Meta validée** : n'importe quel commerçant peut connecter son numéro WhatsApp Business (chemin Meta officiel).
- Swap de 4 Go en place sur le VPS.
- Sauvegarde chiffrée chaque nuit vers le Google Drive, vérifiée le 19 octobre (se déchiffre et s'ouvre en entier, 132 tables).
- Page d'accueil refaite (PR #46), vidéo de fond comprise.
- Lot 1 fait (PR #47) : défauts 1, 2, 3, 4, 7, 12, 13, commandes de nuit, **boîte de réception** (15).
- **Coexistence** : le commerçant garde son application WhatsApp Business (QR code). Ses réponses depuis le téléphone arrivent dans Camille, qui se tait 4 h pour ce client.
- Détection d'un autre outil branché sur le même numéro (connexion et diagnostic).
- Forfaits affichés en **conversations** (tarifs, facturation, fiche agent).
- **Paiement en pause** (Mobile Money manuel comme pawaPay) : à reprendre après l'ouverture.

---

## A. Défauts relevés à l'audit

### 🔴 Font perdre de l'argent ou des clients
1. Le livreur voit « Déjà réglé » dès qu'un moyen de paiement est indiqué, même « espèces à la livraison » (`app/livraison/page.tsx`).
2. Deux livreurs peuvent prendre la même commande : le second écrase le premier (`app/api/courier/orders/[orderId]/route.ts`).
3. Mode « services » (salons, consultants) sur Meta : promet un conseiller, mais personne n'est prévenu (`lib/whatsapp/handle.ts`).
4. Position envoyée sans commande : Camille dit « je garde ça », n'enregistre rien (`lib/whatsapp/boutique.ts`).
5. Le commerçant n'est pas prévenu sur WhatsApp d'une commande arrivée par Meta (push seulement).
6. Après 24 h de silence du client, tout envoi échoue sans bruit (suivi, bon de commande, réclamations, commandes du site) : les modèles de messages ne sont jamais envoyés.
7. Les échecs d'envoi sont invisibles : les accusés de livraison (`statuses`) de Meta sont ignorés.

### 🟠 Incohérences et trous
8. Les forfaits ne sont pas appliqués sur le chemin Meta (le Gratuit a tout le parcours de vente).
9. Le client ne peut pas annuler une commande déjà passée.
10. Livraison : frais fixes sur WhatsApp (zones seulement sur le site), pas de délai annoncé, pas de preuve de livraison, pas d'attribution à un livreur par le commerçant.
11. Restaurant : menu du jour et jours de disponibilité ignorés sur WhatsApp ; minimum de commande non appliqué.
12. Variantes d'un produit importé de Meta : seule la principale est reconnue dans le panier.
13. Stock non revérifié au moment de valider la commande.
14. Produit importé de Meta puis supprimé : peut être réimporté si le retrait chez Meta échoue.

### 🟡 Tableau de bord
15. Pas de boîte de réception : « Répondre » ouvre le WhatsApp personnel du commerçant.
16. Commandes : liste limitée à 200, pas d'export, pas de modification.
17. Modèles de messages : pas d'en-tête, d'image ni de bouton ; catégorie « authentification » mal construite.
18. WhatsApp : recherche par photo non branchée ; vidéos et documents des clients non pris en charge.

### 🔒 Sécurité
19. Clé camille-core en clair dans le workflow n8n v24.
20. Vérifier dans Coolify `META_ALLOW_UNSIGNED` (absent) et `NODE_ENV=production`.
21. Commentaire trompeur dans `app/api/admin/reindex-all/route.ts` (la route est déjà sécurisée).

---

## B. Ajouté le 20 octobre

### Problèmes
22. Commandes de nuit : prises à toute heure sans rien dire au client ni au commerçant.
23. Impossible de payer une commande d'avance.
24. Bonne acquisition, rétention faible : rien ne retient le commerçant.
25. Double saisie : les ventes en boutique ne baissent pas le stock ; les commerces déjà équipés saisissent deux fois.

### Solutions retenues
- **Commandes de nuit** : commande prise et annoncée « traitée dès l'ouverture », marquée « commande de nuit », pas de son la nuit, récapitulatif à l'ouverture.
- **Paiement Mobile Money manuel** (sans intégration) : le client paie au numéro MoMo / Orange Money du commerçant avec la référence de commande et envoie sa capture → « paiement déclaré » → le commerçant touche « Reçu » → « payée ». Le livreur ne voit « Déjà réglé » qu'après confirmation. Acompte possible.
- **Mode caisse** dans l'application (ventes en boutique → stock) et **import CSV / Excel** du catalogue. Connecteurs Shopify / WooCommerce / Odoo plus tard.
- **Site unique pour chaque commerçant** :
  - un **socle** commun branché sur Camille : données en direct (catalogue, prix, stock, horaires, zones, menu du jour), **mise à jour automatique**, panier vers le même tableau de bord, bouton WhatsApp, hébergement (sous-domaine puis domaine propre) ;
  - l'apparence et l'histoire créées avec **DIP** (`end2-237/dip`) : `/dip-create` ou `/dip-transform`, puis `/dip-review` ;
  - bouton « Créer mon site » dans Camille, qui prépare le brief à partir des données du commerçant ;
  - **étape 1** : commande traitée à la main avec DIP ; **étape 2** (après 5 à 10 sites) : automatisation sur un petit serveur **isolé** (Claude Code sans interface + clé API Console, environ 5 à 20 $ de tokens par site), validation humaine avant publication ;
  - variante « commerce » des règles DIP : pages légères, rapides en 3G/4G ;
  - vendu comme **option « Site » : +10 000 FCFA / mois** sur l'abonnement (décidé le 20 octobre).
- **Rétention** : bilan quotidien ou hebdomadaire sur WhatsApp au commerçant, **demandes manquées** (« 14 clients ont demandé X »), carnet clients.

### Forfaits
| Forfait | Prix | Contenu |
|---|---|---|
| Gratuit | 0 | 1 commerce, ~80 conversations / mois, toutes les fonctions de vente |
| Starter | 9 900 FCFA / mois | ~700 conversations, catalogue, panier, livraison, notifications |
| Pro | 24 900 FCFA / mois | ~3 000 conversations, équipe, livreurs, plusieurs commerces, API site |
| Enterprise | sur devis | volumes, accompagnement |
| Option « Site » | +10 000 FCFA / mois | site unique relié au catalogue |

Conversations affichées au lieu des tokens (fait ; 1 conversation ≈ 650 tokens). Reste : faire respecter le forfait sur le chemin Meta.

---

## C. Infra et sécurité

- [ ] Sauvegarde de la base **toutes les 6 heures** (la sauvegarde complète reste nocturne).
- [ ] **Test automatique de la sauvegarde** chaque dimanche sur le VPS (restauration dans un Postgres jetable, comparaison avec la production, alerte Better Stack).
- [ ] Test de restauration complet **chez Hetzner**, une fois, à la main (scénario « serveur perdu »).
- [ ] Ajouter au script de sauvegarde `/data/coolify/{applications,services,proxy,databases}` ; exclure les caches `buildkit`.
- [ ] **n8n : ne garder que 7 jours d'historique** (1,1 Go aujourd'hui, ~200 Mo par sauvegarde).
- [ ] **Place sur le Drive** (presque plein) : voir la section D.
- [ ] Où est géré buyticle.com ? Cloudflare si c'est chez Hostinger.
- [ ] `META_TOKEN_KEY` bien rangée dans les secrets ; sauvegardes Hostinger activées.
- [ ] Clé interne dans les workflows N2/N3 de n8n, puis retrait de `CAMILLE_INTERNAL_KEY_SOUPLE`.
- [ ] Vérification d'entreprise de Buyticle dans le Business Manager ; forfait Groq payant si besoin.
- [ ] Nettoyage automatique de Docker dans Coolify (quotidien, seuil 70 %, sans les volumes).
- [ ] Vérifier que `FIREBASE_SERVICE_ACCOUNT_JSON` est remplie (notifications push).
- [ ] Supprimer du Drive `backup-data-only.tar.gz` et `.zip` (données d'avant le piratage, non chiffrées).
- [x] Page d'accueil : « Application validée par Meta » ; vidéo de fond.

## D. Place sur le Drive

Sur 2,6 Go de sauvegardes, environ **1,8 Go viennent de n8n** (≈ 200 Mo × 9 copies gardées).
1. Limiter l'historique de n8n → le total devrait tomber vers 1 Go.
2. Ne pas répéter n8n ni les médias dans la sauvegarde de 6 heures : seulement la base (22 Mo).
3. Faire le ménage du Drive (anciennes archives, copies en double) et regarder ce qui prend la place (Gmail, Photos).
4. Si ça ne suffit pas : un compte Google dédié aux sauvegardes, ou un stockage objet (Backblaze B2, Cloudflare R2, Hetzner Storage Box).

---

## Avant l'ouverture publique (22 octobre)

- [x] Coexistence avec l'application WhatsApp Business.
- [x] Détection d'un autre outil branché sur le numéro.
- [x] Forfaits en conversations ; option « Site ».
- [x] Guide de connexion pour les commerçants (page WhatsApp + `docs/GUIDE-CONNEXION-WHATSAPP.md`).
- [ ] Dans l'app Meta → Webhooks : cocher `messages` **et** `smb_message_echoes` (plus `history`, `smb_app_state_sync`).
- [ ] Coolify : `WHATSAPP_APP_SECRET` rempli, `NODE_ENV=production`, pas de `META_ALLOW_UNSIGNED`.
- [ ] Vrai test de bout en bout avec un numéro WhatsApp Business de réserve.

## E. Ordre de travail

1. **Sécurité des sauvegardes** : 6 heures, test du dimanche, n8n allégé, dossiers Coolify, place sur le Drive.
2. **Lot 1, défauts** : 1, 2, 3, 4, 5, 7, 12, 13, 21 + commandes de nuit.
3. ~~Paiement Mobile Money manuel et statut payé~~ — en pause.
4. Forfaits (8) et modèles au-delà de 24 h (6, 17).
5. Mode caisse et import CSV / Excel.
6. Bilan quotidien et demandes manquées.
7. Socle du site + « Créer mon site », premiers sites faits avec DIP.
8. Boîte de réception, annulation, livraison, restaurant (9, 10, 11, 15, 16).
9. Campagnes et rendez-vous, puis automatisation des sites.

## F. En attente de décisions

- Reprise du paiement : manuel ou pawaPay (déjà branché dans buyfacturation).
- Où est géré buyticle.com.
- Envoi des workflows N2/N3.
- Packs DIP de référence pour les premiers thèmes.
