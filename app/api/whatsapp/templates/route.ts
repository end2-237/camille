// ─────────────────────────────────────────────────────────────────────────────
// Les modèles de message WhatsApp du commerçant.
//
//   GET   liste les modèles du compte, avec leur statut d'approbation
//   POST  en soumet un nouveau à Meta
//
// Pourquoi cet écran existe : hors de la fenêtre de 24 h, seul un modèle
// approuvé par Meta peut être envoyé. Chaque marchand a donc besoin des SIENS —
// accusé de commande, suivi de livraison, prise en charge d'une réclamation.
// Sans cette page, c'est lui qui doit aller les créer dans les outils de Meta,
// ou nous qui les créons à la main pour chacun.
//
// L'accès est réservé au propriétaire connecté : un modèle engage le nom de son
// commerce auprès de ses clients. Chacun travaille sur SON compte WhatsApp
// (connecté par l'Embedded Signup) ; le compte de la plateforme, partagé, n'est
// ouvert qu'aux administrateurs — un commerçant pouvait y supprimer les modèles
// dont dépendent tous les autres.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, type AuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import * as meta from "@/lib/whatsapp/meta";
import { avecIdentifiants, identifiantsEnv } from "@/lib/whatsapp/contexte-meta";
import { identifiantsAgent } from "@/lib/whatsapp/identifiants";

const SANS_COMPTE =
  "Connectez le WhatsApp officiel d'un de vos agents pour gérer vos propres modèles de message.";

/**
 * Exécute `fn` sur le compte WhatsApp du commerçant : celui de l'agent demandé
 * (?agentId=), sinon le premier de ses agents connecté avec ses propres
 * identifiants. Les administrateurs sans compte propre travaillent sur celui
 * de la plateforme. null : aucun compte accessible.
 */
async function surSonCompte<T>(req: NextRequest, user: AuthUser, fn: () => Promise<T>): Promise<T | null> {
  const demande = req.nextUrl.searchParams.get("agentId");
  const r = await query(
    `SELECT id FROM camille.agents
      WHERE user_id = $1 AND status <> 'archived'
        AND to_jsonb(agents)->>'meta_token_enc' IS NOT NULL
        AND ($2::uuid IS NULL OR id = $2::uuid)
      ORDER BY created_at
      LIMIT 1`,
    [user.id, demande && /^[0-9a-f-]{36}$/i.test(demande) ? demande : null]
  );
  if (r.rows[0]) {
    const ids = await identifiantsAgent(r.rows[0].id);
    if (ids.source === "agent" && ids.wabaId) return avecIdentifiants(ids, fn);
  }
  if (user.is_admin) return avecIdentifiants(identifiantsEnv(), fn);
  return null;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const r = await surSonCompte(req, user, () => meta.listTemplates());
  if (!r) return NextResponse.json({ templates: [], error: SANS_COMPTE, sans_compte: true });
  if (!r.ok) return NextResponse.json({ templates: [], error: r.error }, { status: 200 });

  // Trié par statut : ce qui demande une action du commerçant remonte.
  const rang = (s?: string) =>
    s === "REJECTED" ? 0 : s === "PENDING" || s === "IN_APPEAL" ? 1 : 2;
  const templates = [...r.templates].sort(
    (a, b) => rang(a.status) - rang(b.status) || a.name.localeCompare(b.name)
  );
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = String(b.name || "").trim();
  const body = String(b.body || "").trim();
  const category = String(b.category || "UTILITY").toUpperCase();

  if (!name) return NextResponse.json({ error: "Donne un nom au modèle." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Écris le message du modèle." }, { status: 400 });
  if (!["UTILITY", "MARKETING", "AUTHENTICATION"].includes(category)) {
    return NextResponse.json({ error: "Catégorie inconnue." }, { status: 400 });
  }

  // Les variables se comptent avant l'envoi : Meta refuse un modèle dont les
  // exemples manquent, et le dire ici évite un refus trois jours plus tard.
  const variables = (body.match(/\{\{\s*\d+\s*\}\}/g) || []).length;
  const examples = Array.isArray(b.examples) ? b.examples.map((x: unknown) => String(x ?? "").trim()) : [];
  if (variables > 0 && examples.filter(Boolean).length < variables) {
    return NextResponse.json(
      {
        error:
          `Ce modèle contient ${variables} variable(s). Donne un exemple pour chacune — ` +
          `Meta refuse un modèle dont il ne peut pas juger le rendu réel.`,
      },
      { status: 400 }
    );
  }

  const r = await surSonCompte(req, user, () => meta.createTemplate({
    name,
    category: category as "UTILITY" | "MARKETING" | "AUTHENTICATION",
    language: String(b.language || "fr"),
    body,
    examples,
    footer: b.footer ? String(b.footer) : undefined,
  }));
  if (!r) return NextResponse.json({ error: SANS_COMPTE }, { status: 403 });

  if (!r.ok) {
    // On rend la raison telle que Meta l'a écrite : c'est elle qui permet de
    // corriger. « Un modèle de ce nom existe déjà » et « la catégorie ne
    // correspond pas au contenu » ne se règlent pas de la même façon.
    return NextResponse.json({ error: r.error || "Soumission refusée par Meta" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: r.id, status: r.status || "PENDING" }, { status: 201 });
}

// ── Suppression ─────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const name = (req.nextUrl.searchParams.get("name") || "").trim();
  if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });

  const r = await surSonCompte(req, user, () => meta.deleteTemplate(name));
  if (!r) return NextResponse.json({ error: SANS_COMPTE }, { status: 403 });
  if (!r.ok) return NextResponse.json({ error: r.error || "Suppression refusée" }, { status: 400 });

  // On le répète dans la réponse : le nom ne sera pas réutilisable de sitôt.
  // C'est la seule conséquence vraiment irréversible de ce geste.
  return NextResponse.json({
    ok: true,
    avertissement: `« ${name} » est supprimé. Meta garde ce nom bloqué un long moment : pour recréer ce message, choisis un autre nom.`,
  });
}
