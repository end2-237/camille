// ─────────────────────────────────────────────────────────────────────────────
// Webhook WhatsApp Cloud API.
//
//   GET   la vérification d'abonnement de Meta (hub.challenge)
//   POST  les messages entrants
//
// PORTE NEUVE. Les clients actuels entrent par camille-core → n8n, et ce
// chemin n'est pas touché : il n'y a aucun code partagé entre les deux. Rien
// ici ne peut déconnecter une session Baileys, parce que rien ici ne parle à
// camille-core.
//
// Règle imposée par Meta : répondre 200 TOUT DE SUITE. Un accusé lent est
// réessayé, puis Meta finit par désactiver le point d'arrivée. On accuse donc
// réception, et on traite ensuite — ce qui est aussi ce qui permet de réessayer
// un envoi raté sans que Meta nous renvoie le message.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { handleIncoming, type IncomingMessage } from "@/lib/whatsapp/handle";

// ── Vérification de l'abonnement ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const challenge = p.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN || "";
  if (!expected) {
    return new NextResponse("WHATSAPP_VERIFY_TOKEN absent de l'environnement", { status: 500 });
  }
  if (mode === "subscribe" && token === expected && challenge) {
    // Meta attend le challenge en texte brut, pas en JSON.
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Vérification refusée", { status: 403 });
}

// ── Réception ───────────────────────────────────────────────────────────────

/**
 * La requête vient-elle bien de Meta ?
 *
 * Sans cette vérification, n'importe qui connaissant l'URL peut faire parler
 * l'agent au nom d'un client. Le secret d'application est le seul élément que
 * Meta et nous partageons.
 *
 * Sans `WHATSAPP_APP_SECRET`, on REFUSE en production : sinon n'importe qui
 * connaissant l'URL peut fabriquer des commandes avec les prix de son choix.
 * Pour un test sur son propre numéro uniquement, META_ALLOW_UNSIGNED=1 lève
 * l'interdiction (et le journal le rappelle à chaque message).
 */
function signatureValide(raw: string, header: string | null): { ok: boolean; why?: string } {
  const secret = process.env.WHATSAPP_APP_SECRET || "";
  if (!secret) {
    const tolere =
      process.env.META_ALLOW_UNSIGNED === "1" || process.env.NODE_ENV !== "production";
    return tolere
      ? { ok: true, why: "WHATSAPP_APP_SECRET absent — signature NON vérifiée (toléré : test)" }
      : { ok: false, why: "WHATSAPP_APP_SECRET absent — message refusé (renseigne la clé secrète de l'app Meta)" };
  }
  if (!header?.startsWith("sha256=")) return { ok: false, why: "en-tête X-Hub-Signature-256 absent" };

  const attendu = "sha256=" + crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(attendu);
  if (a.length !== b.length) return { ok: false, why: "signature de longueur inattendue" };
  return crypto.timingSafeEqual(a, b) ? { ok: true } : { ok: false, why: "signature invalide" };
}

/** Ce qu'on retient d'une entrée du webhook. Meta en empile plusieurs. */
function extraire(body: Record<string, unknown>): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  const entries = (body.entry || []) as Record<string, unknown>[];

  for (const entry of entries) {
    for (const ch of (entry.changes || []) as Record<string, unknown>[]) {
      const v = (ch.value || {}) as Record<string, unknown>;
      const meta = (v.metadata || {}) as { phone_number_id?: string };
      const contacts = (v.contacts || []) as { profile?: { name?: string }; wa_id?: string }[];
      const nom = contacts[0]?.profile?.name || "";

      for (const m of (v.messages || []) as Record<string, unknown>[]) {
        const type = String(m.type || "");
        let texte = "";
        let ordre: IncomingMessage["order"];

        if (type === "text") {
          texte = String((m.text as { body?: string })?.body || "");
        } else if (type === "interactive") {
          // Un bouton ou une ligne de liste : le libellé sert de message, et
          // l'identifiant dit exactement ce qui a été choisi — aucune analyse
          // grammaticale nécessaire.
          const i = (m.interactive || {}) as Record<string, unknown>;
          const r = (i.button_reply || i.list_reply || {}) as { id?: string; title?: string };
          texte = r.title || "";
          out.push({
            messageId: String(m.id || ""),
            from: String(m.from || ""),
            phoneNumberId: meta.phone_number_id || "",
            contactName: nom,
            type: "interactive",
            text: texte,
            choiceId: r.id || "",
            timestamp: Number(m.timestamp || 0),
          });
          continue;
        } else if (type === "order") {
          // Le panier natif WhatsApp. C'est l'intérêt central du catalogue
          // Meta : le client compose sa commande lui-même, avec les vrais
          // prix, et nous la recevons structurée.
          const o = (m.order || {}) as Record<string, unknown>;
          const items = ((o.product_items || []) as Record<string, unknown>[]).map((it) => ({
            retailerId: String(it.product_retailer_id || ""),
            quantity: Number(it.quantity || 1),
            price: Number(it.item_price || 0),
            currency: String(it.currency || "XAF"),
          }));
          ordre = { catalogId: String(o.catalog_id || ""), items, note: String(o.text || "") };
          texte = ordre.note || "";
        } else if (type === "button") {
          texte = String((m.button as { text?: string })?.text || "");
        } else if (type === "location") {
          const l = (m.location || {}) as { latitude?: number; longitude?: number };
          out.push({
            messageId: String(m.id || ""),
            from: String(m.from || ""),
            phoneNumberId: meta.phone_number_id || "",
            contactName: nom,
            type: "location",
            text: "",
            location: { lat: Number(l.latitude || 0), lng: Number(l.longitude || 0) },
            timestamp: Number(m.timestamp || 0),
          });
          continue;
        } else if (type === "image") {
          const im = (m.image || {}) as { id?: string; caption?: string };
          out.push({
            messageId: String(m.id || ""),
            from: String(m.from || ""),
            phoneNumberId: meta.phone_number_id || "",
            contactName: nom,
            type: "image",
            text: im.caption || "",
            mediaId: im.id || "",
            timestamp: Number(m.timestamp || 0),
          });
          continue;
        } else if (type === "audio") {
          // Un vocal (ou un fichier audio) : transcrit plus loin, puis traité
          // comme un message écrit.
          const au = (m.audio || {}) as { id?: string; mime_type?: string };
          out.push({
            messageId: String(m.id || ""),
            from: String(m.from || ""),
            phoneNumberId: meta.phone_number_id || "",
            contactName: nom,
            type: "audio",
            text: "",
            mediaId: au.id || "",
            mime: au.mime_type || "audio/ogg",
            timestamp: Number(m.timestamp || 0),
          });
          continue;
        } else {
          // vidéo, document, contact… non traités pour l'instant, mais
          // on les fait remonter pour qu'un « je n'ai pas compris » reste poli
          // plutôt qu'un silence.
          out.push({
            messageId: String(m.id || ""),
            from: String(m.from || ""),
            phoneNumberId: meta.phone_number_id || "",
            contactName: nom,
            type: "unsupported",
            text: "",
            rawType: type,
            timestamp: Number(m.timestamp || 0),
          });
          continue;
        }

        out.push({
          messageId: String(m.id || ""),
          from: String(m.from || ""),
          phoneNumberId: meta.phone_number_id || "",
          contactName: nom,
          type: type === "order" ? "order" : "text",
          text: texte,
          order: ordre,
          timestamp: Number(m.timestamp || 0),
        });
      }
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  // Le corps brut, et lui seul, permet de vérifier la signature : un
  // re-sérialisé JSON ne donne pas les mêmes octets.
  const raw = await req.text();

  // Une notification Meta pèse quelques Ko. Au-delà d'1 Mo, ce n'est pas Meta.
  if (raw.length > 1_000_000) {
    return new NextResponse("Corps trop volumineux", { status: 413 });
  }

  const sig = signatureValide(raw, req.headers.get("x-hub-signature-256"));
  if (!sig.ok) {
    console.warn("[meta webhook] refusé :", sig.why);
    return new NextResponse("Signature refusée", { status: 401 });
  }
  if (sig.why) console.warn("[meta webhook]", sig.why);

  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw); } catch {
    // Corps illisible : on accuse quand même, sinon Meta réessaie en boucle un
    // message qu'on ne saura jamais lire.
    return NextResponse.json({ received: true, ignored: "corps illisible" });
  }

  const messages = extraire(body);

  // On accuse réception AVANT de traiter. Le traitement part détaché : une
  // erreur dedans ne doit ni retarder l'accusé, ni provoquer un réessai de
  // Meta qui produirait une réponse en double.
  for (const m of messages) {
    handleIncoming(m).catch((e) => {
      console.error("[meta webhook] traitement", m.messageId, (e as Error).message);
    });
  }

  return NextResponse.json({ received: true, messages: messages.length });
}
