-- Source du catalogue par agent (pour le mode LIVE marketplace, multi-tenant).
-- catalog_source : 'camille' (défaut, catalogue local) | 'ofs_cj' (plateforme CJ live)
--                  | 'ofs_shop' (boutique du marchand, live)
-- ofs_vendor_id  : id de la boutique OFS quand catalog_source = 'ofs_shop'
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS catalog_source text NOT NULL DEFAULT 'camille';
ALTER TABLE camille.agents ADD COLUMN IF NOT EXISTS ofs_vendor_id  text;
