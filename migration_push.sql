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
