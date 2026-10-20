"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Conversations — la boîte de réception WhatsApp du commerce.
//
// Un numéro connecté par l'API officielle de Meta ne marche plus dans
// l'application WhatsApp Business du téléphone. Quand Camille passait la main
// (réclamation, demande d'un conseiller), le commerçant n'avait donc aucun
// moyen de répondre depuis le numéro de sa boutique. Ici, il lit le fil, répond,
// et rend la main à Camille quand c'est réglé.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Hand, RefreshCw, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import { Bouton, BoutonRond, Pastille, Squelettes, StylesUI, Vide, Bandeau } from "@/components/dashboard/ui";

type Resume = { phone: string; nom: string | null; dernier: string; role: string; le: string; dernierClient: string | null; takeover: boolean };
type Message = { role: "client" | "camille" | "humain"; texte: string; le: string };
type Fil = { phone: string; nom: string | null; takeover: boolean; messages: Message[]; fenetreOuverte: boolean };

const heure = (v: string) => {
  const d = new Date(v);
  const auj = new Date().toDateString() === d.toDateString();
  return auj
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};
const nomDe = (c: { nom: string | null; phone: string }) => c.nom || `+${c.phone}`;
/** Les traces internes (« [carrousel] 4 articles ») se lisent mieux en clair. */
const lisible = (t: string) => t.replace(/^\[([^\]]+)\]\s*/, (_, k) => `${k.charAt(0).toUpperCase()}${k.slice(1)} · `);

export default function ConversationsPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const recherche = useSearchParams();
  const router = useRouter();
  const [liste, setListe] = useState<Resume[] | null>(null);
  const [q, setQ] = useState("");
  const [actif, setActif] = useState<string | null>(recherche.get("tel"));
  const [fil, setFil] = useState<Fil | null>(null);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const basRef = useRef<HTMLDivElement>(null);

  const chargerListe = useCallback(async () => {
    try {
      const r = await fetch(`/api/agents/${agentId}/conversations`, { headers: { ...authHeaders() } });
      const d = await r.json();
      setListe(d.conversations ?? []);
    } catch { setListe([]); }
  }, [agentId]);

  const chargerFil = useCallback(async (tel: string) => {
    try {
      const r = await fetch(`/api/agents/${agentId}/conversations/${tel}`, { headers: { ...authHeaders() } });
      if (r.ok) setFil(await r.json());
    } catch { /* on réessaie au prochain tour */ }
  }, [agentId]);

  useEffect(() => { chargerListe(); const t = setInterval(chargerListe, 20_000); return () => clearInterval(t); }, [chargerListe]);
  useEffect(() => {
    if (!actif) { setFil(null); return; }
    chargerFil(actif);
    const t = setInterval(() => chargerFil(actif), 8_000);
    return () => clearInterval(t);
  }, [actif, chargerFil]);
  useEffect(() => { basRef.current?.scrollIntoView({ block: "end" }); }, [fil?.messages.length]);

  const filtree = useMemo(() => {
    const n = q.trim().toLowerCase();
    const l = liste ?? [];
    return n ? l.filter((c) => [c.phone, c.nom, c.dernier].some((v) => String(v ?? "").toLowerCase().includes(n))) : l;
  }, [liste, q]);

  function ouvrir(tel: string | null) {
    setActif(tel);
    setTexte("");
    router.replace(tel ? `?tel=${tel}` : "?", { scroll: false });
  }

  async function envoyer() {
    if (!actif || !texte.trim()) return;
    setEnvoi(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/conversations/${actif}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ texte }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Message non envoyé");
      setTexte("");
      await chargerFil(actif);
      chargerListe();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  async function main(action: "prendre" | "rendre") {
    if (!actif) return;
    const r = await fetch(`/api/agents/${agentId}/conversations/${actif}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ action }),
    });
    if (r.ok) {
      toast.success(action === "rendre" ? "Camille reprend la conversation." : "Camille se tait : à vous de répondre.");
      chargerFil(actif);
      chargerListe();
    }
  }

  const enAttente = (liste ?? []).filter((c) => c.takeover).length;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
      <StylesUI />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">Conversations</h1>
          <p className={`${actif ? "hidden sm:block" : ""} mt-1 max-w-[620px] text-[13.5px] leading-relaxed`} style={{ color: "var(--cl-ink-soft)" }}>
            Les échanges de vos clients avec Camille, sur le numéro de la boutique. Répondez vous-même quand
            il le faut : Camille se met en pause pour ce client jusqu&apos;à ce que vous lui rendiez la main.
          </p>
        </div>
        {enAttente > 0 && <Pastille ton="ambre" point>{enAttente} client{enAttente > 1 ? "s" : ""} attend{enAttente > 1 ? "ent" : ""} votre réponse</Pastille>}
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* ── La liste ───────────────────────────────────────────────────── */}
        <section className={`${actif ? "hidden lg:block" : ""} ui-carte overflow-hidden rounded-[28px]`}>
          <div className="flex items-center gap-2 p-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cl-ink-faint)" }} />
              <input className="ui-champ !pl-10" placeholder="Nom, numéro, message…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <BoutonRond icone={RefreshCw} label="Actualiser" onClick={chargerListe} />
          </div>
          <div className="max-h-[calc(100vh-280px)] min-h-[300px] overflow-y-auto px-2 pb-2">
            {liste === null ? <Squelettes n={5} hauteur={64} /> : !filtree.length ? (
              <p className="px-4 py-10 text-center text-[13.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                {q ? "Aucune conversation ne correspond." : "Aucune conversation ces 30 derniers jours."}
              </p>
            ) : filtree.map((c) => (
              <button key={c.phone} onClick={() => ouvrir(c.phone)}
                className="flex w-full items-start gap-3 rounded-[20px] px-3 py-3 text-left transition-colors"
                style={{ background: actif === c.phone ? "var(--cl-accent-soft)" : "transparent" }}>
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                  style={{ background: c.takeover ? "#FDF1DC" : "#F1EFF4", color: c.takeover ? "#9A6510" : "var(--cl-ink-soft)" }}>
                  {(c.nom || c.phone.slice(-2)).slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-medium" style={{ color: "var(--cl-ink)" }}>{nomDe(c)}</span>
                    <span className="flex-shrink-0 text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>{heure(c.le)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: "var(--cl-ink-soft)" }}>
                    {c.role === "user" ? "" : c.role === "humain" ? "Vous : " : "Camille : "}{lisible(c.dernier)}
                  </span>
                  {c.takeover && <span className="mt-1 inline-block"><Pastille ton="ambre">À vous de répondre</Pastille></span>}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Le fil ─────────────────────────────────────────────────────── */}
        <section className={`${actif ? "" : "hidden lg:flex"} ui-carte flex min-h-[520px] flex-col overflow-hidden rounded-[28px]`}>
          {!actif ? (
            <div className="m-auto p-6"><Vide doodle="reading" titre="Choisissez une conversation" texte="Le fil du client s'affiche ici, avec ce que Camille lui a déjà répondu." /></div>
          ) : !fil ? (
            <div className="p-6"><Squelettes n={4} hauteur={48} /></div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--cl-line-soft)" }}>
                <BoutonRond icone={ArrowLeft} label="Retour à la liste" className="lg:hidden" onClick={() => ouvrir(null)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium" style={{ color: "var(--cl-ink)" }}>{nomDe(fil)}</p>
                  <p className="text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>+{fil.phone}</p>
                </div>
                {fil.takeover ? (
                  <Bouton variante="encre" icone={Bot} onClick={() => main("rendre")}>
                    <span className="sm:hidden">À Camille</span><span className="hidden sm:inline">Rendre la main à Camille</span>
                  </Bouton>
                ) : (
                  <Bouton variante="doux" icone={Hand} onClick={() => main("prendre")}>Je m&apos;en occupe</Bouton>
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4" style={{ background: "#FAF9FC", maxHeight: "calc(100vh - 340px)", minHeight: 300 }}>
                {fil.messages.map((m, i) => {
                  const client = m.role === "client";
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`max-w-[80%] rounded-[18px] px-3.5 py-2 text-[13.5px] leading-snug ${client ? "rounded-tl-[6px]" : "ml-auto rounded-tr-[6px]"}`}
                      style={{
                        background: client ? "#fff" : m.role === "humain" ? "var(--cl-ink)" : "var(--cl-accent-soft)",
                        color: m.role === "humain" ? "#fff" : "var(--cl-ink)",
                        boxShadow: client ? "inset 0 0 0 1px var(--cl-line-soft)" : "none",
                        whiteSpace: "pre-wrap",
                      }}>
                      {!client && <span className="mb-0.5 block text-[10.5px] font-medium opacity-70">{m.role === "humain" ? "Vous" : "Camille"}</span>}
                      {lisible(m.texte)}
                      <span className="mt-1 block text-right text-[10.5px] opacity-60">{heure(m.le)}</span>
                    </motion.div>
                  );
                })}
                <div ref={basRef} />
              </div>

              <div className="border-t p-3" style={{ borderColor: "var(--cl-line-soft)" }}>
                {!fil.fenetreOuverte ? (
                  <Bandeau ton="ambre" titre="Plus de 24 h sans message de ce client">
                    WhatsApp n&apos;autorise un message libre que dans les 24 h qui suivent le dernier message du client.
                    Il faudra un modèle de message approuvé, ou attendre qu&apos;il vous réécrive.
                  </Bandeau>
                ) : (
                  <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
                    <textarea className="ui-champ min-h-[48px] flex-1" rows={2} maxLength={4000}
                      placeholder="Votre réponse, envoyée depuis le numéro de la boutique…"
                      value={texte} onChange={(e) => setTexte(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); } }} />
                    <Bouton type="submit" variante="encre" icone={Send} occupe={envoi} disabled={envoi || !texte.trim()}>Envoyer</Bouton>
                  </form>
                )}
                {!fil.takeover && fil.fenetreOuverte && (
                  <p className="mt-2 px-2 text-[11.5px]" style={{ color: "var(--cl-ink-faint)" }}>
                    Dès votre premier message, Camille se met en pause pour ce client.
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
