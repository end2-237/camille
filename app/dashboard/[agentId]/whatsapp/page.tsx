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
import { motion, AnimatePresence } from "framer-motion";
import { BadgeCheck, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Unplug, ShieldCheck, ShoppingBag, MousePointerClick, Phone, CalendarClock, BookOpen } from "lucide-react";
import { authHeaders } from "@/lib/auth-client";
import { Doodle, type NomDoodle } from "@/components/dashboard/Doodle";

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
    <div className="wa py-6 lg:py-8">
      <AnimatePresence>
        {manque.length ? (
          <motion.div key="manque" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-start gap-3 rounded-[22px] px-5 py-4 text-[13.5px] leading-relaxed" style={{ background: "#FDF1DC", color: "#7A4F00" }}>
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              <strong>Configuration incomplète.</strong> À renseigner dans l&apos;environnement de Camille :{" "}
              {manque.map((m) => <code key={m} className="mr-1.5 inline-block break-all rounded-full bg-white/70 px-2 py-0.5 text-[12px]">{m}</code>)}
            </span>
          </motion.div>
        ) : null}
        {msg ? (
          <motion.div key={msg.texte} initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-start gap-3 rounded-[22px] px-5 py-4 text-[13.5px] leading-relaxed"
            style={{ background: msg.ok ? "#E7F7EC" : "#FBEAE6", color: msg.ok ? "#1E6A37" : "#8E3322" }}>
            {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
            <span>
              {msg.texte}
              {msg.details?.length ? <ul className="mt-1.5 list-disc pl-5">{msg.details.map((d) => <li key={d}>{d}</li>)}</ul> : null}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!etat ? (
        <div className="wa-hero flex min-h-[320px] items-center justify-center rounded-[32px]">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--cl-accent)" }} />
        </div>
      ) : etat.connecte ? (
        <Connecte etat={etat} occupe={occupe} onActualiser={actualiser} onDeconnecter={deconnecter} />
      ) : (
        <AConnecter test={etat.transport === "meta"} occupe={occupe} bloque={manque.length > 0} onConnecter={connecter} />
      )}
    </div>
  );
}

// ── Les morceaux ────────────────────────────────────────────────────────────

function IconeWhatsapp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

const apparait = (i: number) => ({
  initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 },
  transition: { delay: 0.06 * i, type: "spring" as const, stiffness: 380, damping: 30 },
});

const ATOUTS = [
  { Icone: BadgeCheck, texte: "Votre nom vérifié" },
  { Icone: ShoppingBag, texte: "Votre catalogue dans WhatsApp" },
  { Icone: MousePointerClick, texte: "Boutons et listes interactifs" },
];

const ETAPES: { titre: string; texte: string; doodle: NomDoodle }[] = [
  { titre: "Ouvrez la fenêtre Meta", texte: "Connectez-vous avec le compte Facebook de votre entreprise.", doodle: "reading" },
  { titre: "Choisissez votre numéro", texte: "Sélectionnez ou créez votre compte WhatsApp Business et le numéro à relier.", doodle: "sitting-reading" },
  { titre: "Validez le code", texte: "Recevez le code par SMS ou appel, validez : Camille répond en votre nom.", doodle: "meditating" },
];

function AConnecter({ test, occupe, bloque, onConnecter }: { test: boolean; occupe: boolean; bloque: boolean; onConnecter: () => void }) {
  return (
    <>
      <motion.section {...apparait(0)} className="wa-hero relative grid items-center gap-6 overflow-hidden rounded-[32px] p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:p-10">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[12.5px]" style={{ color: "var(--cl-ink-soft)" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: test ? "#E0A43A" : "#B9B3C2" }} />
            {test ? "Aujourd'hui : numéro de test de Camille" : "WhatsApp officiel pas encore activé"}
          </span>
          <h2 className="mt-4 text-[clamp(28px,3.4vw,42px)] font-medium leading-[1.08] tracking-[-0.035em]" style={{ color: "var(--cl-ink)" }}>
            Vos clients vous écrivent.<br />Camille répond avec <span style={{ color: "var(--cl-accent-deep)" }}>votre</span> numéro.
          </h2>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
            Reliez votre propre WhatsApp Business par la fenêtre officielle de Meta. Deux minutes, sans rien installer.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {ATOUTS.map(({ Icone, texte }) => (
              <span key={texte} className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-2 text-[13px]" style={{ color: "var(--cl-ink)" }}>
                <Icone className="h-4 w-4" style={{ color: "var(--cl-accent-deep)" }} /> {texte}
              </span>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <motion.button onClick={onConnecter} disabled={occupe || bloque} whileHover={{ scale: occupe || bloque ? 1 : 1.03 }} whileTap={{ scale: 0.97 }}
              className="wa-cta flex items-center gap-3 rounded-full py-2 pl-2 pr-6 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "#25D366" }}>
                {occupe ? <Loader2 className="h-5 w-5 animate-spin" /> : <IconeWhatsapp className="h-5 w-5" />}
              </span>
              {occupe ? "Connexion en cours…" : "Connecter mon WhatsApp"}
            </motion.button>
            <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>
              <ShieldCheck className="h-4 w-4" /> Fenêtre officielle Meta · accès chiffré
            </span>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.92, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 18 }}
          className="relative hidden justify-center lg:flex">
          <span className="wa-halo absolute inset-0 m-auto h-[78%] w-[78%] rounded-full" />
          <Doodle nom="selfie" className="relative h-[clamp(220px,30vh,320px)] w-auto" />
        </motion.div>
      </motion.section>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {ETAPES.map((e, i) => (
          <motion.article key={e.titre} {...apparait(i + 1)} className="wa-etape flex flex-col rounded-[28px] p-5">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold text-white" style={{ background: "var(--cl-ink)" }}>{i + 1}</span>
              <Doodle nom={e.doodle} className="h-[92px] w-auto" />
            </div>
            <h3 className="mt-3 text-[16px] font-medium" style={{ color: "var(--cl-ink)" }}>{e.titre}</h3>
            <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "var(--cl-ink-faint)" }}>{e.texte}</p>
          </motion.article>
        ))}
      </div>
      <Styles />
    </>
  );
}

function Connecte({ etat, occupe, onActualiser, onDeconnecter }: { etat: Etat; occupe: boolean; onActualiser: () => void; onDeconnecter: () => void }) {
  const tuiles = [
    { Icone: BadgeCheck, titre: "Nom vérifié", valeur: etat.nom_verifie || "—" },
    { Icone: Phone, titre: "Numéro", valeur: etat.numero || "—" },
    { Icone: BookOpen, titre: "Catalogue", valeur: etat.catalogue ? "Relié" : "Aucun catalogue relié", alerte: !etat.catalogue },
    { Icone: CalendarClock, titre: "Connecté depuis", valeur: etat.connecte_le ? new Date(etat.connecte_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—" },
  ];
  return (
    <>
      <motion.section {...apparait(0)} className="wa-hero relative grid items-center gap-6 overflow-hidden rounded-[32px] p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:p-10">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[12.5px]" style={{ color: "#1E6A37" }}>
            <span className="wa-pouls h-2 w-2 rounded-full" style={{ background: "#25D366" }} /> Connecté et actif
          </span>
          <h2 className="mt-4 text-[clamp(28px,3.4vw,42px)] font-medium leading-[1.08] tracking-[-0.035em]" style={{ color: "var(--cl-ink)" }}>
            {etat.nom_verifie || "Votre WhatsApp"} parle<br />avec la voix de Camille.
          </h2>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed" style={{ color: "var(--cl-ink-soft)" }}>
            Chaque message reçu sur {etat.numero || "votre numéro"} est traité par votre agent, avec votre nom vérifié et votre catalogue.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <motion.button onClick={onActualiser} disabled={occupe} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-medium disabled:opacity-60" style={{ color: "var(--cl-ink)" }}>
              <RefreshCw className={"h-4 w-4 " + (occupe ? "animate-spin" : "")} /> Actualiser le catalogue
            </motion.button>
            <motion.button onClick={onDeconnecter} disabled={occupe} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium disabled:opacity-60" style={{ color: "#A63D28", background: "rgba(255,255,255,0.55)" }}>
              <Unplug className="h-4 w-4" /> Déconnecter
            </motion.button>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 18 }}
          className="relative hidden justify-center lg:flex">
          <span className="wa-halo absolute inset-0 m-auto h-[78%] w-[78%] rounded-full" />
          <Doodle nom="float" className="wa-flotte relative h-[clamp(200px,28vh,300px)] w-auto" />
        </motion.div>
      </motion.section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tuiles.map(({ Icone, titre, valeur, alerte }, i) => (
          <motion.div key={titre} {...apparait(i + 1)} className="wa-etape rounded-[26px] p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: alerte ? "#FDF1DC" : "var(--cl-accent-soft)", color: alerte ? "#9A6510" : "var(--cl-accent-deep)" }}>
              <Icone className="h-[18px] w-[18px]" />
            </span>
            <p className="mt-4 text-[12.5px]" style={{ color: "var(--cl-ink-faint)" }}>{titre}</p>
            <p className="mt-0.5 truncate text-[17px] font-medium" style={{ color: "var(--cl-ink)" }}>{valeur}</p>
          </motion.div>
        ))}
      </div>
      <Styles />
    </>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      .wa-hero { background: linear-gradient(135deg, #F4F0FF 0%, #ECE5FF 55%, #E3F8EA 100%); }
      .wa-halo { background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%); }
      .wa-cta { background: var(--cl-ink); box-shadow: 0 14px 30px rgba(25,23,27,0.22); }
      .wa-etape { border: 1px solid var(--cl-line-soft); background: #fff; transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s ease; }
      .wa-etape:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(70,40,190,0.10); }
      .wa-pouls { animation: wa-pouls 1.8s ease-out infinite; }
      @keyframes wa-pouls { 0% { box-shadow: 0 0 0 0 rgba(37,211,102,.55); } 100% { box-shadow: 0 0 0 9px rgba(37,211,102,0); } }
      .wa-flotte { animation: wa-flotte 5s ease-in-out infinite; }
      @keyframes wa-flotte { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      @media (prefers-reduced-motion: reduce) { .wa-pouls, .wa-flotte { animation: none; } }
    `}</style>
  );
}
