// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/agents/[agentId]/conversations/[phone] → le fil d'un client
// POST /api/agents/[agentId]/conversations/[phone]
//        { texte }              → répondre depuis le numéro de la boutique
//        { action: "prendre" }  → le commerçant prend la main (Camille se tait)
//        { action: "rendre" }   → Camille reprend la conversation
//
// Une réponse du commerçant met Camille en pause pour ce client : parler
// par-dessus un humain est pire que se taire. Elle reprend quand il « rend la
// main ».
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut } from "@/lib/equipe";
import { tracer } from "@/lib/whatsapp/handle";
import { envoyerMeta } from "@/lib/whatsapp/modeles";

type RouteContext = { params: Promise<{ agentId: string; phone: string }> };

async function autorise(req: NextRequest, agentId: string) {
  const user = await getUserFromRequest(req);
  if (!user) return { refus: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!(await peut(user.id, agentId, "ventes"))) return { refus: NextResponse.json({ error: "Agent introuvable" }, { status: 404 }) };
  return { user };
}

const tel = (p: string) => decodeURIComponent(p).replace(/[^0-9]/g, "");

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { agentId, phone } = await params;
  const { refus } = await autorise(req, agentId);
  if (refus) return refus;
  const p = tel(phone);

  const [fil, contact] = await Promise.all([
    query(
      `SELECT role, content, created_at FROM camille.agent_conversations
        WHERE session_name = 'meta:' || $1::text AND contact_phone = $2
        ORDER BY created_at DESC LIMIT 150`,
      [agentId, p]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT to_jsonb(c)->>'display_name' AS nom, COALESCE(human_takeover, false) AS takeover
         FROM camille.contacts c WHERE agent_id = $1 AND phone = $2`,
      [agentId, p]
    ).catch(() => ({ rows: [] })),
  ]);
  const messages = (fil.rows as Record<string, unknown>[]).reverse().map((m) => ({
    role: m.role === "user" ? "client" : m.role === "humain" ? "humain" : "camille",
    texte: String(m.content || ""),
    le: m.created_at,
  }));
  const dernierClient = [...messages].reverse().find((m) => m.role === "client")?.le ?? null;
  return NextResponse.json({
    phone: p,
    nom: contact.rows[0]?.nom ?? null,
    takeover: Boolean(contact.rows[0]?.takeover),
    messages,
    // WhatsApp n'autorise un message libre que dans les 24 h qui suivent le
    // dernier message du client.
    fenetreOuverte: dernierClient ? Date.now() - new Date(dernierClient as string).getTime() < 24 * 3600_000 : false,
  });
}

async function mettreEnPause(agentId: string, phone: string, pause: boolean) {
  await query(
    `INSERT INTO camille.contacts (agent_id, phone, human_takeover, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (agent_id, phone) DO UPDATE SET human_takeover = $3, updated_at = NOW()`,
    [agentId, phone, pause]
  );
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId, phone } = await params;
  const { refus } = await autorise(req, agentId);
  if (refus) return refus;
  const p = tel(phone);
  if (!p) return NextResponse.json({ error: "Numéro invalide" }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { texte?: string; action?: string };

  if (b.action === "prendre" || b.action === "rendre") {
    await mettreEnPause(agentId, p, b.action === "prendre");
    return NextResponse.json({ ok: true, takeover: b.action === "prendre" });
  }

  const texte = String(b.texte || "").trim().slice(0, 4000);
  if (!texte) return NextResponse.json({ error: "Message vide" }, { status: 400 });

  // Fenêtre de 24 h fermée : le message part dans le modèle de relais.
  const r = await envoyerMeta(agentId, p, texte);
  if (!r.ok) {
    return NextResponse.json({ error: `Message non envoyé : ${r.error || "erreur WhatsApp"}` }, { status: 502 });
  }
  await tracer(agentId, p, "humain", texte);
  await mettreEnPause(agentId, p, true).catch(() => {});
  return NextResponse.json({ ok: true, takeover: true, modele: Boolean(r.modele) });
}
