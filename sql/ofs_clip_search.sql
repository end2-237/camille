-- ofs_clip_search.sql — recherche visuelle & sémantique à l'échelle du catalogue OFS.
-- À COLLER DANS LE SQL EDITOR DU SUPABASE OFS (pas celui de camille).
--
-- Idée : CLIP (clip-vit-base-patch32, 512 dims) place image ET texte dans le MÊME
-- espace. Une seule colonne clip_embedding suffit donc pour :
--   • recherche par image  → on vectorise la photo entrante et on cherche les plus proches
--   • recherche sémantique → on vectorise le texte de la requête et on cherche pareil
-- pgvector fait le top-k côté base : ça scale à 100k+ produits sans rien charger en RAM.

create extension if not exists vector;

-- 1 seule colonne, partagée image + texte (espace CLIP commun)
alter table public.products add column if not exists clip_embedding vector(512);

-- Index ANN cosinus (ivfflat). lists ~ sqrt(nb_lignes) ; 200 = bon pour 40k–200k produits.
-- (À créer APRÈS avoir rempli une bonne partie des embeddings pour un meilleur clustering.)
create index if not exists products_clip_embedding_idx
  on public.products using ivfflat (clip_embedding vector_cosine_ops) with (lists = 200);

-- RPC unique : recherche par vecteur CLIP (image OU texte), avec filtres marketplace.
--   q         : vecteur CLIP 512 de la requête (image ou texte)
--   k         : nombre de résultats
--   only_cj   : true = seulement produits plateforme/dropshipping (vendor_id null, >99%)
--   vend      : id d'un vendeur précis (boutique), en texte, ou null
-- Renvoie CHAQUE produit en jsonb complet (robuste : aucune colonne à énumérer,
-- donc indépendant du schéma exact d'OFS) + un score de similarité (1 = identique).
create or replace function public.match_products_clip(
  q        vector(512),
  k        int     default 8,
  only_cj  boolean default false,
  vend     text    default null
)
returns table (product jsonb, similarity float)
language sql stable as $$
  select
    to_jsonb(p) - 'clip_embedding' as product,   -- on retire le gros vecteur du payload
    1 - (p.clip_embedding <=> q)   as similarity
  from public.products p
  where p.clip_embedding is not null
    and (not only_cj or p.vendor_id is null)
    and (vend is null or p.vendor_id::text = vend)
  order by p.clip_embedding <=> q
  limit k;
$$;

-- Combien de produits déjà indexés ? (diagnostic)
-- select count(*) filter (where clip_embedding is not null) as indexed, count(*) as total from public.products;
