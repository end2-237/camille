-- ─────────────────────────────────────────────────────────────────────────────
-- migration_site_integration.sql
--
-- Ce qu'un site marchand demandait et que Camille ne savait pas porter :
--   1. QUAND livrer          → orders.scheduled_at (+ étape « en livraison »)
--   2. OÙ EN EST la commande → agents.webhook_url : Camille prévient le site
--   3. QUI est le client     → contacts enrichis (nom, e-mail, adresses…)
--
-- Purement additive : aucune colonne existante n'est touchée, aucune valeur
-- n'est réécrite. Une base non migrée continue de fonctionner — le code
-- retombe sur les chemins sans ces colonnes (erreur 42703 rattrapée).
--
-- Idempotent. À appliquer sur le Postgres de camille, APRÈS migration_orders.sql
-- et migration_contacts.sql.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Créneau de livraison ─────────────────────────────────────────────────
-- Un traiteur livre « demain 12h20 », pas « dès que possible ». Sans date
-- prévue, l'information finissait dans la note, tronquée à 120 caractères et
-- impossible à trier.
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- L'étape qui manquait entre « en traitement » et « livrée » : la commande est
-- partie. Le client demande « c'est parti ? », pas « c'est en cuisine ? ».
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

COMMENT ON COLUMN camille.orders.scheduled_at IS
  'Créneau de livraison demandé par le client. NULL = dès que possible.';
COMMENT ON COLUMN camille.orders.dispatched_at IS
  'Passage au statut en_livraison. NULL = pas encore parti.';

-- Le commerçant ouvre sa journée sur « qu''est-ce que je livre aujourd''hui ».
CREATE INDEX IF NOT EXISTS idx_orders_scheduled
  ON camille.orders (agent_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- ── 2. Webhook sortant ──────────────────────────────────────────────────────
-- Sans lui, un site ne peut afficher l'avancement qu'en interrogeant Camille en
-- boucle. Avec lui, Camille pousse le changement au moment où il arrive.
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS webhook_url text;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS webhook_secret text;

COMMENT ON COLUMN camille.agents.webhook_url IS
  'URL HTTPS avertie des changements de statut de commande. NULL = désactivé.';
COMMENT ON COLUMN camille.agents.webhook_secret IS
  'Secret partagé : signe le corps en HMAC-SHA256 (en-tête X-Camille-Signature).';

-- ── 3. Fiche client ─────────────────────────────────────────────────────────
-- camille.contacts ne portait que l'état de la conversation WhatsApp (langue,
-- accueil, reprise humaine). Un client qui commande depuis un site a un nom,
-- une adresse et un historique — sans quoi il ressaisit tout à chaque fois.
ALTER TABLE camille.contacts ADD COLUMN IF NOT EXISTS display_name  text;
ALTER TABLE camille.contacts ADD COLUMN IF NOT EXISTS email         text;
ALTER TABLE camille.contacts ADD COLUMN IF NOT EXISTS company       text;
ALTER TABLE camille.contacts ADD COLUMN IF NOT EXISTS addresses     jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE camille.contacts ADD COLUMN IF NOT EXISTS orders_count  integer NOT NULL DEFAULT 0;
ALTER TABLE camille.contacts ADD COLUMN IF NOT EXISTS last_order_at timestamptz;

COMMENT ON COLUMN camille.contacts.display_name IS 'Nom donné par le client (site ou conversation).';
COMMENT ON COLUMN camille.contacts.company IS 'Entreprise de rattachement, pour les livraisons au bureau.';
COMMENT ON COLUMN camille.contacts.addresses IS
  'Adresses enregistrées : [{label, address, lat, lng, details}]. La première sert de défaut.';

COMMIT;
