// POST /api/agents/[agentId]/products/upload  (multipart: file, kind?)
// Upload d'une image vers Camille Core → renvoie { url }.
//
// Malgré son chemin, la route sert toute image de l'agent : photo produit,
// carte du menu, logo du bon de commande. `kind` ne sert qu'à nommer le fichier
// de façon lisible dans le dossier média de core.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ agentId: string }> };

const coreUrl = () => (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");
const coreKey = () => process.env.CAMILLE_CORE_API_KEY ?? "camille-core-secret";

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { agentId } = await params;
  const owns = await query(
    "SELECT id FROM camille.agents WHERE id = $1 AND user_id = $2 AND status != 'archived'",
    [agentId, user.id]
  );
  if (!owns.rows.length) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Corps invalide (multipart attendu)" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Champ file requis" }, { status: 400 });

  const okTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!okTypes.includes(file.type)) {
    return NextResponse.json({ error: "Format accepté : JPG, PNG, WEBP, GIF" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image trop lourde (max 5 Mo)" }, { status: 400 });
  }

  try {
    const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    // Liste fermée : `kind` finit dans un nom de fichier, il ne doit pas
    // pouvoir y introduire un séparateur de chemin.
    const kindRaw = String(formData.get("kind") ?? "product");
    const kind = [
      "product", "logo", "menu", "banner",
      // Natures de la médiathèque : elles ne servent qu'à nommer le fichier.
      "category", "gallery", "services", "flyers",
    ].includes(kindRaw)
      ? kindRaw
      : "product";
    const filename = `${agentId.replace(/-/g, "")}_${kind}_${Date.now()}.${ext}`;
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const uploadRes = await fetch(`${coreUrl()}/api/media/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": coreKey() },
      body: JSON.stringify({ name: filename, data: base64, mimeType: file.type }),
    });
    if (!uploadRes.ok) {
      const t = await uploadRes.text();
      return NextResponse.json({ error: `Upload échoué: ${t}` }, { status: 502 });
    }
    const { url } = (await uploadRes.json()) as { url: string };
    return NextResponse.json({ url, filename });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
