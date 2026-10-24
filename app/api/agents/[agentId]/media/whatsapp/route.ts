// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agents/[agentId]/media/whatsapp
//
//   multipart { file }                     → dépose une vidéo, recompressée au
//                                            besoin pour WhatsApp
//   JSON { action: "verifier", url }       → passe-t-elle chez Meta ? (rien n'est modifié)
//   JSON { action: "compresser", url }     → en fait une version conforme, déposée
//   JSON { action: "compresser", accueil: true }
//                                          → idem pour la vidéo d'accueil de
//                                            l'agent, qui est remplacée
//
// Réponse : { url?, compressee?, avant, apres?, passe, raisons, resume }.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { peut } from "@/lib/equipe";
import { fichierDeLAgent } from "@/lib/fichiers";
import { type InfoVideo, resumeVideo } from "@/lib/video-regles";
import { VIDEO_SOURCE_MAX, analyserOctets, deposerSurCore, preparerVideo, telechargerVideo, type Preparation } from "@/lib/video";

type RouteContext = { params: Promise<{ agentId: string }> };

const coreUrl = () => (process.env.CAMILLE_CORE_URL ?? "https://camille-core.vps.buyticle.com").replace(/\/$/, "");

// Une vérification coûte un téléchargement : on garde le résultat dix minutes.
const VERIFS = new Map<string, { r: object; expire: number }>();

const decrire = (i: InfoVideo) => ({ ...i, resume: resumeVideo(i) });

function reponsePreparation(url: string, p: Preparation) {
  return {
    url,
    compressee: p.compressee,
    avant: decrire(p.avant),
    apres: decrire(p.apres),
    passe: p.verdict.passe,
    raisons: p.verdict.raisons,
  };
}

async function capacites(agentId: string): Promise<Record<string, unknown>> {
  const r = await query("SELECT capabilities FROM camille.agents WHERE id = $1", [agentId]);
  const raw = r.rows[0]?.capabilities;
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try { return JSON.parse(raw as string); } catch { return {}; }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { agentId } = await params;
  if (!(await peut(user.id, agentId, "reglages"))) {
    return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
  }
  const prefixe = agentId.replace(/-/g, "");

  try {
    // ── Dépôt d'un fichier ────────────────────────────────────────────────
    if ((req.headers.get("content-type") || "").startsWith("multipart/form-data")) {
      const form = await req.formData().catch(() => null);
      const fichier = form?.get("file");
      if (!(fichier instanceof File)) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
      if (!fichier.type.startsWith("video/")) return NextResponse.json({ error: "Ce n'est pas une vidéo." }, { status: 400 });
      if (fichier.size > VIDEO_SOURCE_MAX) {
        return NextResponse.json({ error: `Vidéo trop volumineuse (max ${VIDEO_SOURCE_MAX / 1048576} Mo).` }, { status: 400 });
      }
      const prep = await preparerVideo(Buffer.from(await fichier.arrayBuffer()));
      const url = await deposerSurCore(`${prefixe}_parcours_video_${Date.now()}.mp4`, prep.octets);
      return NextResponse.json(reponsePreparation(url, prep), { status: 201 });
    }

    const corps = (await req.json().catch(() => ({}))) as { action?: string; url?: string; accueil?: boolean };

    // ── Vérifier ──────────────────────────────────────────────────────────
    if (corps.action === "verifier") {
      const url = String(corps.url || "");
      const garde = VERIFS.get(url);
      if (garde && garde.expire > Date.now()) return NextResponse.json(garde.r);
      const { info, verdict } = await analyserOctets(await telechargerVideo(url));
      const r = { avant: decrire(info), passe: verdict.passe, raisons: verdict.raisons, reparable: verdict.reparable };
      VERIFS.set(url, { r, expire: Date.now() + 600_000 });
      return NextResponse.json(r);
    }

    // ── Compresser une vidéo déjà en ligne ────────────────────────────────
    if (corps.action === "compresser") {
      const caps = corps.accueil ? await capacites(agentId) : null;
      const source = caps ? String(caps.welcome_video_url || "") : String(corps.url || "");
      if (!source) return NextResponse.json({ error: "Aucune vidéo à compresser." }, { status: 400 });
      const prep = await preparerVideo(await telechargerVideo(source));
      if (!prep.compressee) return NextResponse.json(reponsePreparation(source, prep));

      const url = await deposerSurCore(`${prefixe}_${caps ? "welcome_video" : "parcours_video"}_${Date.now()}.mp4`, prep.octets);
      if (caps) {
        // La vidéo d'accueil est remplacée partout où l'agent l'utilise ;
        // l'ancienne est effacée de core si c'est bien un fichier de cet agent.
        const ancien = fichierDeLAgent(source, agentId);
        caps.welcome_video_url = url;
        await query("UPDATE camille.agents SET capabilities = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(caps), agentId]);
        if (ancien) {
          await fetch(`${coreUrl()}/api/media/${encodeURIComponent(ancien)}`, {
            method: "DELETE", headers: { "X-Api-Key": process.env.CAMILLE_CORE_API_KEY ?? "" },
          }).catch(() => {});
        }
      }
      VERIFS.delete(source);
      return NextResponse.json(reponsePreparation(url, prep));
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[media/whatsapp]", msg);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
