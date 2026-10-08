// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/[agentId]/whatsapp/page.tsx
//
// Le commerçant connecte SON WhatsApp Business à Camille, par la fenêtre
// officielle de Meta (Embedded Signup) : il choisit ou crée son compte,
// vérifie son numéro, et c'est fini. Camille parle ensuite en son nom, avec
// son numéro et son catalogue.
//
// La fenêtre renvoie deux choses, à deux moments : un CODE (via FB.login) et,
// par un message de la fenêtre, l'identifiant du compte et du numéro. On attend
// les deux un court instant avant d'appeler le serveur — qui sait de toute
// façon les retrouver si le second n'arrive pas.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { authHeaders } from "@/lib/auth-client";

type Etat = {
  connecte: boolean;
  transport: string;
  numero: string | null;
  nom_verifie: string | null;
  catalogue: string | null;
  connecte_le: string | null;
  pret: { app_id: boolean; config_id: boolean; secret: boolean; coffre: boolean };
};

type FBLoginReponse = { authResponse?: { code?: string } | null; status?: string };
type FBSdk = {
  init: (o: Record<string, unknown>) => void;
  login: (cb: (r: FBLoginReponse) => void, o: Record<string, unknown>) => void;
};
declare global {
  interface Window { FB?: FBSdk; fbAsyncInit?: () => void }
}

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "";
const CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID || "";
const GRAPH = process.env.NEXT_PUBLIC_GRAPH_VERSION || "v26.0";

const CADRE = { border: "1px solid var(--cl-line)", borderRadius: 12, background: "#fff" };

/** Le SDK Facebook, chargé une fois. */
function chargerSdk(): Promise<FBSdk> {
  return new Promise((resolve, reject) => {
    if (window.FB) return resolve(window.FB);
    window.fbAsyncInit = () => {
      window.FB!.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: GRAPH });
      resolve(window.FB!);
    };
    if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.async = true;
      s.defer = true;
      s.crossOrigin = "anonymous";
      s.src = "https://connect.facebook.net/fr_FR/sdk.js";
      s.onerror = () => reject(new Error("Impossible de charger la fenêtre de Meta (bloqueur de publicités ?)"));
      document.body.appendChild(s);
    }
  });
}

export default function WhatsappOfficielPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string; details?: string[] } | null>(null);
  const session = useRef<{ waba_id?: string; phone_number_id?: string }>({});

  const charger = useCallback(async () => {
    try {
      const r = await fetch(`/api/agents/${agentId}/meta`, { headers: await authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Lecture impossible");
      setEtat(d);
    } catch (e) {
      setMsg({ ok: false, texte: (e as Error).message });
    }
  }, [agentId]);

  useEffect(() => { charger(); }, [charger]);

  // Les identifiants du compte et du numéro, envoyés par la fenêtre de Meta.
  useEffect(() => {
    const ecoute = (ev: MessageEvent) => {
      try {
        if (!/(^|\.)facebook\.com$/.test(new URL(ev.origin).hostname)) return;
        const d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (d.event === "CANCEL") setMsg({ ok: false, texte: "Connexion annulée dans la fenêtre de Meta." });
        if (d.data?.waba_id) session.current.waba_id = String(d.data.waba_id);
        if (d.data?.phone_number_id) session.current.phone_number_id = String(d.data.phone_number_id);
      } catch { /* message d'une autre nature : ignoré */ }
    };
    window.addEventListener("message", ecoute);
    return () => window.removeEventListener("message", ecoute);
  }, []);

  const connecter = async () => {
    setMsg(null);
    setOccupe(true);
    session.current = {};
    try {
      const FB = await chargerSdk();
      const code = await new Promise<string>((resolve, reject) => {
        FB.login(
          (r) => (r.authResponse?.code ? resolve(r.authResponse.code) : reject(new Error("Connexion non terminée."))),
          {
            config_id: CONFIG_ID,
            response_type: "code",
            override_default_response_type: true,
            extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
          }
        );
      });
      // Le message de la fenêtre arrive parfois juste après le code.
      await new Promise((r) => setTimeout(r, 1200));
      const r = await fetch(`/api/agents/${agentId}/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ code, ...session.current }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Connexion refusée");
      setMsg({ ok: true, texte: `WhatsApp connecté : ${d.nom_verifie || ""} ${d.numero || ""}`.trim(), details: d.avertissements });
      await charger();
    } catch (e) {
      setMsg({ ok: false, texte: (e as Error).message });
    } finally {
      setOccupe(false);
    }
  };

  const actualiser = async () => {
    setOccupe(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/meta`, { method: "PUT", headers: await authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Actualisation impossible");
      setMsg({ ok: true, texte: d.catalogue ? "Catalogue relié." : "Toujours aucun catalogue relié à ce compte." });
      await charger();
    } catch (e) {
      setMsg({ ok: false, texte: (e as Error).message });
    } finally {
      setOccupe(false);
    }
  };

  const deconnecter = async () => {
    if (!confirm("Déconnecter ce WhatsApp de Camille ? L'agent ne répondra plus sur ce numéro.")) return;
    setOccupe(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/meta`, { method: "DELETE", headers: await authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Déconnexion impossible");
      setMsg({ ok: true, texte: "WhatsApp déconnecté." });
      await charger();
    } catch (e) {
      setMsg({ ok: false, texte: (e as Error).message });
    } finally {
      setOccupe(false);
    }
  };

  const manque = etat
    ? [
        !APP_ID && "NEXT_PUBLIC_META_APP_ID",
        !CONFIG_ID && "NEXT_PUBLIC_META_CONFIG_ID",
        !etat.pret.secret && "WHATSAPP_APP_SECRET",
        !etat.pret.coffre && "META_TOKEN_KEY",
      ].filter(Boolean) as string[]
    : [];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 80px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "var(--cl-ink)", margin: 0 }}>
        WhatsApp officiel
      </h1>
      <p style={{ color: "var(--cl-sub)", fontSize: 13.5, lineHeight: 1.55, marginTop: 6, maxWidth: "62ch" }}>
        Connectez <strong>votre propre numéro WhatsApp Business</strong> par la fenêtre officielle de Meta.
        Camille répondra en votre nom, avec votre numéro, votre nom vérifié et votre catalogue.
      </p>

      {manque.length ? (
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "#FDF1DC",
          border: "1px solid #E0B870", fontSize: 13, lineHeight: 1.5 }}>
          <strong>Configuration incomplète.</strong> À renseigner dans l&apos;environnement de Camille :{" "}
          {manque.map((m) => <code key={m} style={{ marginRight: 6 }}>{m}</code>)}
        </div>
      ) : null}

      {msg ? (
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.5,
          background: msg.ok ? "#EAF7EF" : "#F7E8E4", border: `1px solid ${msg.ok ? "#1DAB55" : "#A63D28"}` }}>
          {msg.texte}
          {msg.details?.length ? (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{msg.details.map((d) => <li key={d}>{d}</li>)}</ul>
          ) : null}
        </div>
      ) : null}

      <div style={{ ...CADRE, marginTop: 20, padding: "18px 20px" }}>
        {!etat ? (
          <p style={{ fontSize: 13, color: "var(--cl-sub)", margin: 0 }}>Chargement…</p>
        ) : etat.connecte ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: "#1DAB55" }} />
              <strong style={{ fontSize: 15, color: "var(--cl-ink)" }}>Connecté</strong>
            </div>
            <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "6px 12px", fontSize: 13.5, marginTop: 14 }}>
              <dt style={{ color: "var(--cl-sub)" }}>Nom vérifié</dt><dd style={{ margin: 0 }}>{etat.nom_verifie || "—"}</dd>
              <dt style={{ color: "var(--cl-sub)" }}>Numéro</dt><dd style={{ margin: 0 }}>{etat.numero || "—"}</dd>
              <dt style={{ color: "var(--cl-sub)" }}>Catalogue</dt>
              <dd style={{ margin: 0 }}>
                {etat.catalogue ? "Relié" : "Aucun catalogue relié"}
                {" · "}
                <button onClick={actualiser} disabled={occupe}
                  style={{ border: "none", background: "none", padding: 0, color: "var(--cl-accent-deep)", cursor: "pointer", fontSize: 13.5 }}>
                  Actualiser
                </button>
              </dd>
              <dt style={{ color: "var(--cl-sub)" }}>Depuis le</dt>
              <dd style={{ margin: 0 }}>{etat.connecte_le ? new Date(etat.connecte_le).toLocaleString("fr-FR") : "—"}</dd>
            </dl>
            <button onClick={deconnecter} disabled={occupe}
              style={{ marginTop: 18, fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 9,
                border: "1px solid #E5B5AE", background: "#fff", color: "#A63D28", cursor: "pointer" }}>
              Déconnecter ce WhatsApp
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: "var(--cl-ink)", margin: 0, lineHeight: 1.55 }}>
              {etat.transport === "meta"
                ? "Cet agent répond aujourd'hui avec le numéro de test de Camille. Connectez le vôtre pour parler en votre nom."
                : "Cet agent n'utilise pas encore WhatsApp officiel."}
            </p>
            <ol style={{ fontSize: 13, color: "var(--cl-sub)", lineHeight: 1.7, margin: "12px 0 0", paddingLeft: 18 }}>
              <li>Une fenêtre Meta s&apos;ouvre : connectez-vous avec le compte Facebook de votre entreprise.</li>
              <li>Choisissez ou créez votre compte WhatsApp Business et votre numéro.</li>
              <li>Recevez le code par SMS ou appel, et validez. C&apos;est tout.</li>
            </ol>
            <button onClick={connecter} disabled={occupe || manque.length > 0}
              style={{ marginTop: 16, fontSize: 14, fontWeight: 700, padding: "11px 18px", borderRadius: 10,
                border: "none", background: "#1877F2", color: "#fff",
                cursor: occupe ? "wait" : "pointer", opacity: occupe || manque.length ? 0.6 : 1 }}>
              {occupe ? "Connexion en cours…" : "Connecter mon WhatsApp"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
