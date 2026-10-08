-- ═══════════════════════════════════════════════════════════════════════════
-- migration_restaurant.sql
--
-- Ce qu'il faut à un restaurant en plus d'une boutique :
--   • products.options : les options d'un plat (accompagnement, sauce, piment,
--     cuisson), demandées au client une fois le panier reçu ;
--     [{ "name": "Accompagnement", "required": true,
--        "choices": [{ "label": "Plantain", "price": 0 }, { "label": "Frites", "price": 500 }] }]
--   • meta_paniers.etat : où en est le panier dans ses questions (options en
--     cours, heure de commande choisie).
--
-- ENTIÈREMENT ADDITIVE. Rejouable sans risque.
--   psql "$DATABASE_URL" -f migration_restaurant.sql
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE camille.products    ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]';
ALTER TABLE camille.meta_paniers ADD COLUMN IF NOT EXISTS etat   JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN camille.products.options IS
  'Options d''un plat demandées après le panier : [{name, required, choices:[{label, price}]}].';
COMMENT ON COLUMN camille.meta_paniers.etat IS
  'Progression du panier : questions d''options restantes, heure de commande choisie.';
