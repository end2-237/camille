-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : table camille.contacts
-- Stocke l'état d'accueil et la préférence de langue de chaque contact WhatsApp.
-- Exécuter sur : supabase.vps.buyticle.com:5432 (base camille)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camille.contacts (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID         NOT NULL REFERENCES camille.agents(id) ON DELETE CASCADE,
  phone         TEXT         NOT NULL,
  language_pref TEXT         DEFAULT NULL,   -- 'fr' | 'en' | 'es' | 'ar' | 'pt' | 'de'
  welcomed_at   TIMESTAMPTZ  DEFAULT NULL,   -- NULL = pas encore accueilli
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT contacts_agent_phone_unique UNIQUE (agent_id, phone)
);

-- Index pour les lookups rapides par agent + phone
CREATE INDEX IF NOT EXISTS idx_contacts_agent_phone
  ON camille.contacts (agent_id, phone);

-- Index pour les stats par agent (ex. nombre de contacts uniques)
CREATE INDEX IF NOT EXISTS idx_contacts_agent_id
  ON camille.contacts (agent_id);

COMMENT ON TABLE camille.contacts IS
  'Contact WhatsApp par agent : langue préférée et état d''accueil.';
COMMENT ON COLUMN camille.contacts.welcomed_at IS
  'NULL = nouveau contact (accueil pas encore envoyé). Renseigné dès l''envoi du message d''accueil.';
COMMENT ON COLUMN camille.contacts.language_pref IS
  'Code langue choisi par le contact : fr, en, es, ar, pt, de. NULL = langue par défaut de l''agent.';
