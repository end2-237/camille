// GET /api/tiles/{z}/{x}/{y}.png — le fond de carte, servi par Camille.
//
// La carte du suivi restait blanche en production : les tuiles venaient d'un
// domaine tiers, et selon le réseau du commerçant, l'en-tête de sécurité du
// déploiement ou l'humeur du fournisseur, elles n'arrivaient jamais. Un
// rectangle blanc avec des boutons de zoom, c'est pire que pas de carte.
//
// En passant par notre propre domaine, il n'y a plus qu'un seul chemin à
// surveiller. Le serveur, lui, s'annonce correctement — c'est ce que demande
// la politique d'usage d'OpenStreetMap, et c'est ce qui manquait au navigateur.
//
// Les tuiles ne changent pas : on les laisse en cache un jour chez le visiteur
// et une semaine en amont, pour ne pas refaire le trajet à chaque déplacement
// de la carte.

const OSM = "https://tile.openstreetmap.org";
const SECOURS = "https://a.basemaps.cartocdn.com/rastertiles/voyager";

const UA =
  "Camille by Buyticle (+https://buyticle.com; suivi de livraison, usage faible volume)";

type Ctx = { params: Promise<{ z: string; x: string; y: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { z, x, y } = await params;

  // Trois entiers, rien d'autre : ce chemin ne doit pas pouvoir servir à
  // récupérer autre chose que des tuiles.
  const zoom = Number(z);
  const col = Number(x);
  const ligne = Number(y.replace(/\.png$/i, ""));
  const borne = 2 ** zoom;
  const valide =
    Number.isInteger(zoom) && zoom >= 0 && zoom <= 19 &&
    Number.isInteger(col) && col >= 0 && col < borne &&
    Number.isInteger(ligne) && ligne >= 0 && ligne < borne;
  if (!valide) return new Response("Tuile hors limites", { status: 400 });

  const chemin = `/${zoom}/${col}/${ligne}.png`;

  for (const hote of [OSM, SECOURS]) {
    try {
      const r = await fetch(hote + chemin, {
        headers: { "User-Agent": UA, Accept: "image/png,image/*" },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      return new Response(r.body, {
        headers: {
          "Content-Type": r.headers.get("content-type") ?? "image/png",
          // Un jour chez le visiteur, une semaine en amont : une tuile ne
          // change pas d'un déplacement de carte à l'autre.
          "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        },
      });
    } catch {
      /* fournisseur injoignable : on tente le suivant */
    }
  }

  // Aucun fond disponible : on répond une tuile transparente plutôt qu'une
  // erreur, pour que la carte garde ses repères et son tracé.
  const vide = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  return new Response(new Uint8Array(vide), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=60" },
  });
}
