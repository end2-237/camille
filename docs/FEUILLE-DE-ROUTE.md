# Feuille de route de Camille — MVP

> Décidée le 20 octobre 2026, mise à jour le soir même. À relire au début de chaque session.
> Le paiement en ligne est **en pause** (Mobile Money manuel comme pawaPay) : à reprendre après l'ouverture.

## Ce qui est fait

| Sujet | Où |
|---|---|
| App review Meta validée, swap 4 Go, sauvegarde nocturne vérifiée (132 tables) | VPS |
| Page d'accueil refaite, vidéo de fond | #46 |
| Défauts 1, 2, 3, 4, 7, 12, 13, commandes de nuit, boîte de réception (15) | #47 |
| Coexistence avec l'app WhatsApp Business, autre outil branché, forfaits en conversations, guide commerçant | #48 |
| Forfaits appliqués sur Meta (8), messages au-delà de 24 h (6), modèles complets (17) | #49 |
| Annulation (9), livraison (10), restaurant (11), réimport (14), commandes (16), photos et médias (18) | #50 |
| Bilan du matin, demandes manquées, caisse, import Excel, option « Site » | lot suivant |
| Base toutes les 6 h, test de restauration du dimanche, dossiers Coolify, corbeille du Drive | btldelivery `outils/serveur` |

Défaut 5 (prévenir le commerçant sur WhatsApp) : **volontairement non fait**. Sur le chemin Meta, son numéro est celui de la boutique ; il est prévenu par notification et voit tout dans la boîte de réception.
Défaut 21 : le commentaire était déjà corrigé.

### Option « Site »
**+10 000 FCFA / mois** sur l'abonnement.
- Page « Mon site » : le commerçant décrit ce qu'il veut, Camille prépare le brief à partir de ses données.
- L'exploitation reçoit la demande, copie le brief pour `/dip-create` (DIP, `end2-237/dip`), puis passe le site « en ligne ».
- Le site lit le catalogue en direct (`/api/public/v1/catalog`) et envoie ses commandes par `/api/public/v1/orders`.
- **Étape 2**, après 5 à 10 sites : automatisation sur un petit serveur isolé (Claude Code sans interface + clé API Console), validation humaine avant publication.

## À faire de ton côté (après chaque déploiement)

1. **SQL** dans Supabase Studio : `migration_ouverture.sql` (additive, idempotente).
2. **App Meta → Webhooks** : cocher `messages`, `smb_message_echoes`, `history`, `smb_app_state_sync`.
3. **Coolify, application Camille** :
   - vérifier `WHATSAPP_APP_SECRET`, `NODE_ENV=production`, l'absence de `META_ALLOW_UNSIGNED`, `META_APP_ID` (images d'en-tête des modèles) ;
   - `CAMILLE_TACHES=0` seulement si une seconde instance tourne (sinon deux bilans).
4. **Coolify, n8n** : ne garder que 7 jours d'historique avec `EXECUTIONS_DATA_PRUNE=true`, `EXECUTIONS_DATA_MAX_AGE=168`, `EXECUTIONS_DATA_PRUNE_MAX_COUNT=5000`, `DB_SQLITE_VACUUM_ON_STARTUP=true`.
5. **Serveur** :
   - copier `sauvegarde-drive.sh`, `sauvegarde-base.sh` et `test-restauration.sh` dans `/root`, puis relancer `installer-sauvegarde.sh` ;
   - créer deux heartbeats Better Stack et les mettre dans `/etc/sauvegarde-drive.env` (`HEARTBEAT_BASE_URL`, `HEARTBEAT_TEST_URL`) ;
   - lancer une fois `test-restauration` à la main.
6. Le **vrai test** avec un numéro WhatsApp Business de réserve. Si Meta demande un code SMS au lieu du QR code, s'arrêter : le Cameroun n'est pas dans la liste officielle de la coexistence.

## Ce qui reste

### Décisions et actions qui ne sont pas du code
- **19.** Clé camille-core en clair dans le workflow n8n v24 : à remplacer par une variable n8n, puis tourner la clé.
- Workflows N2/N3 à recevoir, puis retrait de `CAMILLE_INTERNAL_KEY_SOUPLE`.
- Test de restauration complet chez Hetzner, une fois, à la main (scénario « serveur perdu »).
- **Place sur le Drive** : après l'allègement de n8n, regarder ce qui reste ; sinon compte Google dédié ou stockage objet (B2, R2, Storage Box).
- Supprimer du Drive `backup-data-only.tar.gz` et `.zip` (données d'avant le piratage, non chiffrées).
- Nettoyage automatique de Docker dans Coolify ; sauvegardes Hostinger ; `META_TOKEN_KEY` dans les secrets.
- Domaine buyticle.com : savoir où il est géré.
- Vérification d'entreprise de Buyticle chez Meta ; forfait Groq payant si besoin.
- Vérifier que `FIREBASE_SERVICE_ACCOUNT_JSON` est remplie (sans elle, pas de notification push).
- buyfacturation : tourner les secrets publiés dans `.env.vercel` (dépôt public).

### Produit, plus tard
- **Paiement** : Mobile Money manuel (capture, « Reçu ») ou pawaPay (déjà branché dans buyfacturation), acompte, statut « payée ». La FAQ des tarifs annonce déjà MTN / Orange.
- Connecteurs Shopify / WooCommerce / Odoo ; import `.xlsx` direct (aujourd'hui : CSV).
- Campagnes (modèles marketing vers le carnet clients) et rendez-vous (mode « services »).
- Automatisation des sites (étape 2 ci-dessus).

## Repères techniques
- 1 conversation ≈ 650 tokens : un client qui écrit après 24 h de silence ouvre une conversation, décomptée du forfait.
- Le modèle `camille_info` est installé à la connexion WhatsApp ; il porte tout envoi au-delà de 24 h.
- Bilan du matin : à l'heure d'ouverture lue dans les horaires (8 h par défaut), lancé chaque heure par `instrumentation.ts` (ou `POST /api/internal/bilan`).
