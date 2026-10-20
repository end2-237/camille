-- ─────────────────────────────────────────────────────────────────────────────
-- migration_option_site_prix.sql
--
--   - camille.parametres : les réglages de la plateforme modifiables par
--     l'administration (ici, le prix par défaut de l'option Site) ;
--   - plans.site_addon_xaf : le supplément Site propre à un forfait
--     (vide = le prix par défaut).
--
-- Additive et idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS camille.parametres (
  cle        TEXT PRIMARY KEY,
  valeur     TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO camille.parametres (cle, valeur) VALUES ('prix_option_site', '10000') ON CONFLICT (cle) DO NOTHING;

ALTER TABLE camille.plans ADD COLUMN IF NOT EXISTS site_addon_xaf INTEGER;
