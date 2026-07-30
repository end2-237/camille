-- ═════════════════════════════════════════════════════════════════════════════
-- migration_all.sql — TOUT ce qui reste a appliquer sur la base CAMILLE.
--
-- A lancer sur le Postgres de Camille (PAS sur le Supabase de buyfacturation).
-- Entierement rejouable : aucune donnee existante n'est touchee.
--
-- Contenu :
--   0. Source du catalogue          (bascule catalogue natif / OFS)
--   1. Geolocalisation des agents   (itineraire vendeur)
--   2. Commandes + suivi + document (bon de commande, livraison)
--   3. Notifications push           (jetons + journal in-app)
--   4. Carte du menu, frais de livraison, version minimale de l'app
--   5. Traces de conversation       (analyse de friction, interne)
--   6. Cles d'API publiques         (integration du site d'un client)
-- ═════════════════════════════════════════════════════════════════════════════


-- ═════════════════════ migration_agent_catalog_source.sql ═════════════════════

-- Source du catalogue par agent (pour le mode LIVE marketplace, multi-tenant).
-- catalog_source : 'camille' (défaut, catalogue local) | 'ofs_cj' (plateforme CJ live)
--                  | 'ofs_shop' (boutique du marchand, live)
-- ofs_vendor_id  : id de la boutique OFS quand catalog_source = 'ofs_shop'
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS catalog_source text NOT NULL DEFAULT 'camille';
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS ofs_vendor_id  text;

-- ═════════════════════ migration_agent_geo.sql ═════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- migration_agent_geo.sql — coordonnées de la boutique (pour sendLocation)
-- Idempotent. psql "$DATABASE_URL" -f migration_agent_geo.sql
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9,6) DEFAULT NULL;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6) DEFAULT NULL;
COMMENT ON COLUMN camille.agents.latitude  IS 'Latitude de la boutique (sendLocation)';
COMMENT ON COLUMN camille.agents.longitude IS 'Longitude de la boutique (sendLocation)';
COMMIT;
-- Exemple pour définir la position (Douala) :
--   UPDATE camille.agents SET latitude=4.0511, longitude=9.7679 WHERE id='...';

-- ═════════════════════ migration_orders.sql ═════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Commandes initiées depuis la conversation (SANS flux de paiement).
-- La commande ENREGISTRE et NOTIFIE ; elle ne réserve pas le stock et ne gère
-- pas de cycle logistique. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camille.orders (
  id             BIGSERIAL PRIMARY KEY,
  ref            TEXT UNIQUE,            -- référence courte affichée au client (ex: A4F7C2)
  agent_id       UUID,
  session_name   TEXT,
  contact_phone  TEXT,
  customer_name  TEXT,
  address        TEXT,                                -- adresse tapee par le client
  lat            DOUBLE PRECISION,                    -- position partagee via WhatsApp
  lng            DOUBLE PRECISION,
  place_label    TEXT,                                -- adresse resolue depuis lat/lng

  items          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{name, variant, qty, price, currency}]
  total          NUMERIC(12,2) DEFAULT 0,
  currency       TEXT DEFAULT 'XAF',

  -- Cycle de vie volontairement minimal
  status         TEXT NOT NULL DEFAULT 'nouvelle',    -- nouvelle | traitee | annulee
  note           TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_agent_time ON camille.orders (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON camille.orders (status);

-- Mode de conversion de l'agent :
--   'whatsapp' → la vente se conclut dans la conversation (défaut)
--   'boutique' → on renvoie vers le site marchand du client
ALTER TABLE camille.agents
  ADD COLUMN IF NOT EXISTS conversion_mode TEXT NOT NULL DEFAULT 'whatsapp';

-- ── Livraison : coordonnees du client (rejouable sur une base deja migree) ────
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS address     TEXT;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS lat         DOUBLE PRECISION;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS lng         DOUBLE PRECISION;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS place_label TEXT;

-- Corrige les commandes enregistrees avant le correctif : une position absente
-- etait convertie en 0,0 (Number(null) === 0), soit un point au large du Ghana.
UPDATE camille.orders
   SET lat = NULL, lng = NULL, place_label = NULL
 WHERE lat = 0 AND lng = 0;

-- ── Suivi de commande : horodatage des etapes du cycle de vie ────────────────
-- nouvelle (a traiter) → en_traitement → livree ; annulee possible a tout moment.
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ;

-- Les commandes deja marquees "traitee" avant l'ajout du cycle : on leur donne
-- une date de traitement, sinon leur suivi apparaitrait vide.
UPDATE camille.orders
   SET processing_at = COALESCE(processing_at, updated_at)
 WHERE status = 'traitee' AND processing_at IS NULL;

-- ── Bon de commande PDF (buyfacturation) ─────────────────────────────────────
-- Memorise le document envoye au client pour ne pas le regenerer et pouvoir
-- le renvoyer depuis le dashboard.
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS doc_number TEXT;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS doc_url    TEXT;

-- ═════════════════════ migration_push.sql ═════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications push : jetons d'appareil (Firebase Cloud Messaging).
-- Un utilisateur peut avoir plusieurs appareils ; un appareil réinstallé
-- change de jeton, d'où la contrainte d'unicité sur le jeton lui-même.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camille.push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL DEFAULT 'android',   -- android | ios | web
  -- Un jeton refusé par FCM est désactivé plutôt que supprimé : on garde
  -- la trace pour le diagnostic.
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_user ON camille.push_tokens (user_id) WHERE active;

-- Journal des notifications : sert au centre de notifications in-app.
CREATE TABLE IF NOT EXISTS camille.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  kind        TEXT NOT NULL,                     -- commande | alerte | systeme
  title       TEXT NOT NULL,
  body        TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user_time ON camille.notifications (user_id, created_at DESC);

-- ═════════════════════ migration_features.sql ═════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Carte du menu, frais de livraison, version minimale de l'app.
-- A lancer sur le Postgres de Camille. Entierement rejouable.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Restauration : carte du menu envoyee sur demande ─────────────────────────
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS menu_image_url TEXT;

-- ── Livraison : montant par defaut + bareme par quartier ─────────────────────
-- Le bareme est un tableau [{zone, fee}] : le quartier du client est cherche
-- dedans, sinon on applique le montant par defaut.
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS delivery_fee     NUMERIC(10,2) NOT NULL DEFAULT 1000;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS delivery_zones   JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Les frais appliques sont figes sur la commande : changer le bareme plus tard
-- ne doit pas reecrire l'historique.
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS thanked_at   TIMESTAMPTZ;

-- ── Version minimale exigee de l'app mobile ──────────────────────────────────
CREATE TABLE IF NOT EXISTS camille.app_release (
  platform     TEXT PRIMARY KEY,              -- android | ios
  min_version  TEXT NOT NULL DEFAULT '1.0.0', -- en-deca : app bloquee
  latest_version TEXT NOT NULL DEFAULT '1.0.0',
  download_url TEXT,
  notes        TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO camille.app_release (platform, min_version, latest_version)
VALUES ('android', '1.0.0', '1.0.0')
ON CONFLICT (platform) DO NOTHING;

-- ═════════════════════ migration_conversation_traces.sql ═════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Boîte noire conversationnelle : une ligne par TOUR de conversation.
-- Permet d'analyser une DISCUSSION entière (parcours, signature, friction),
-- et de rejouer de vraies conversations contre une nouvelle version du workflow.
-- Idempotent : réexécutable sans risque.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camille.conversation_traces (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        UUID,
  session_name    TEXT,
  contact_phone   TEXT,

  -- Le message du client (nécessaire au rejeu)
  user_msg        TEXT,

  -- Ce que la recherche a décidé
  search_q        TEXT,
  search_off      INT,
  search_kind     TEXT,          -- new | ctx | more

  -- Ce que le LLM a proposé vs ce que l'Ancrage a retenu
  llm_intent      TEXT,
  final_intent    TEXT,
  corrected       BOOLEAN DEFAULT FALSE,

  -- Ce qui a été répondu
  resolved_product TEXT,
  reply_mode      TEXT,          -- text | card | category
  items           INT,
  cart_size       INT,

  -- Coûts
  tokens          INT,
  latency_ms      INT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traces_agent_time
  ON camille.conversation_traces (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_traces_contact
  ON camille.conversation_traces (session_name, contact_phone, created_at);

-- Purge : on ne garde que 90 jours de traces.
-- (à brancher sur un cron, ou exécuter manuellement)
-- DELETE FROM camille.conversation_traces WHERE created_at < NOW() - INTERVAL '90 days';


-- ═════════════════════ migration_api_keys.sql ═════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Cles d'API publiques : permettent au site d'un client d'appeler Camille
-- comme n'importe quel consommateur d'API.
--
-- Deux natures de cle :
--   cam_pk_… (publique) — LECTURE seule du catalogue. Exposable dans un
--                         navigateur, protegee par la liste des domaines.
--   cam_sk_… (secrete)  — CREATION de commandes. Serveur uniquement.
--
-- On ne stocke JAMAIS la cle en clair : seulement son empreinte SHA-256.
-- Elle n'est affichee qu'une fois, a la creation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camille.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL,
  user_id      UUID NOT NULL,

  label        TEXT NOT NULL DEFAULT 'Site web',
  kind         TEXT NOT NULL CHECK (kind IN ('public', 'secret')),
  key_hash     TEXT NOT NULL UNIQUE,     -- SHA-256 de la cle
  key_prefix   TEXT NOT NULL,            -- 12 premiers caracteres, pour reconnaitre la cle

  -- Domaines autorises pour les appels navigateur (CORS). Vide = tous.
  origins      JSONB NOT NULL DEFAULT '[]'::jsonb,

  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  calls_count  BIGINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_agent ON camille.api_keys (agent_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_hash  ON camille.api_keys (key_hash);

-- Origine d'une commande : conversation WhatsApp, ou site du client via l'API.
ALTER TABLE camille.orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'whatsapp';
