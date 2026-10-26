# Contexte Buyticle (à jour au 26 octobre 2026)

Données de départ pour ne pas reposer les questions déjà résolues. Si un point semble dépassé,
le signaler et le faire confirmer plutôt que de le supposer.

## L'entreprise
- **ETS Buyticle**, Douala (Cameroun), entreprise individuelle, vérifiée chez Meta.
- Fondateur seul, développeur et commercial à la fois : le **temps** est la ressource la plus rare.
- Trésorerie serrée : quelques dizaines de milliers de FCFA de marge ; chaque dépense compte.
- Infrastructure : un VPS Hostinger KVM2 (~24,50 $/mois), Coolify, Supabase auto-hébergé,
  sauvegardes chiffrées quotidiennes vers Google Drive. Une intrusion (React2Shell) en
  octobre 2026 a été corrigée : la sécurité est un sujet sensible.

## Les produits
- **Camille** — agent IA WhatsApp pour commerçants (commande, catalogue, livraison,
  rendez-vous, santé, restaurant, parcours visuels « mini n8n », compression vidéo).
  API officielle Meta (Tech Provider, Embedded Signup v5, coexistence : le commerçant garde
  son application WhatsApp Business). Forfaits : Gratuit, Starter 9 900 FCFA/mois,
  Pro 24 900 FCFA/mois, Entreprise (199 € indicatif, sur devis). Paiement des abonnements
  via buyfacturation ; pawaPay en cours (collecte seulement, plafond 1 000 € de volume).
- **Camille Core** — ancienne passerelle WhatsApp non officielle (Baileys) + n8n, encore
  utilisée par No Limit jusqu'au 4 novembre 2026.
- **Snl / No Limit** — application de stock multi-sites (Douala, Yaoundé, Bafoussam) pour
  No Limit, distributeur de produits de santé / compléments ; site vitrine nolimitcm.com.
- **kix** — tournois (poules façon Ligue des champions, arbitres, QR codes, promotion payante).
- **Yoosfood** — restauration, premier client Camille (site + Camille, 50 000 FCFA).
- **DIP** — sites vitrines générés ; **buyfacturation** — facturation / paiements.

## Le marché
- Commerçants camerounais : vendent beaucoup par WhatsApp (statuts, catalogues), paient en
  **Mobile Money (MTN MoMo, Orange Money)**, sont sensibles au prix et à la confiance, ont
  peu de temps, souvent un seul téléphone pour tout.
- Clients finaux : téléphones d'entrée de gamme, data chère, vocaux très utilisés, français
  et anglais (et pidgin), beaucoup montrent une photo plutôt que d'écrire.
- Concurrence : outils internationaux (Wati, Respond.io, chatbots génériques) chers et peu
  adaptés ; prestataires locaux qui « bricolent » des bots non officiels.

## Leçons déjà apprises
- Ne jamais promettre « numéro jamais bloqué » : promettre la connexion officielle Meta.
- Coexistence : le numéro doit être libre de toute API ; ne jamais passer par le parcours SMS
  avec un numéro WhatsApp Business.
- Les réponses dans les 24 h sont gratuites chez Meta ; les modèles (relances) sont payants
  et exigent un moyen de paiement chez le commerçant.
- Vidéos WhatsApp : 16 Mo max — Camille compresse automatiquement.
- Santé (No Limit) : pas de vente de médicaments sur ordonnance par WhatsApp.
- Accueil trop long (texte + 2 vocaux + 4 vidéos) = risque de blocages par les clients.
- Panne récurrente « supabase-db introuvable » quand une app n'est pas sur le réseau coolify.
