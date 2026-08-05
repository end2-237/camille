"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Console d'exploitation.
//
// Une ligne par agent, cinq colonnes qui disent en un regard qui va bien et qui
// est en train de partir. C'est la vue qui manquait le jour où trois workflows
// n8n sont restés inactifs pendant qu'un client demandait deux fois la carte :
// l'information existait, elle n'était visible nulle part.
//
// Deux actions, celles qu'on faisait à la main dans Postgres : changer un plan,
// relancer une session.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldAlert, RotateCw, Check, X } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";

interface Ligne {
  id: string;
  name: string;
  business_name: string | null;
  level: number;
  owner: { id: string; email: string; name: string | null };
  plan: string;
  plan_expires_at: string | null;
  plan_expired: boolean;
  session: { name: string; status: string; updated_at: string } | null;
  tokens: { used: number; limit: number | null; percent: number };
  messages_7j: number;
  dernier_jour_actif: string | null;
  commandes_7j: number;
  derniere_commande: string | null;
}

const PLANS = ["free", "starter", "pro", "enterprise"];

/** Combien de jours depuis cette date ? `null` quand elle manque. */
function joursDepuis(iso: string | null): number | null {
  if (!iso) return null;
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return Number.isFinite(j) ? j : null;
}

/**
 * Le diagnostic d'une ligne, en une phrase.
 *
 * L'ordre compte : on nomme le problème le plus grave, pas tous. Une console
 * qui affiche quatre avertissements par ligne ne se lit plus.
 */
function diagnostic(l: Ligne): { texte: string; ton: "ko" | "attention" | "ok" } {
  if (l.session && l.session.status !== "WORKING" && l.session.status !== "CONNECTED") {
    return { texte: `WhatsApp ${l.session.status.toLowerCase()}`, ton: "ko" };
  }
  if (!l.session) return { texte: "aucune session WhatsApp", ton: "ko" };
  if (l.plan_expired) return { texte: "abonnement expiré", ton: "ko" };

  const inactif = joursDepuis(l.dernier_jour_actif);
  if (inactif === null) return { texte: "jamais activé", ton: "attention" };
  if (inactif >= 3) return { texte: `silencieux depuis ${inactif} j`, ton: "ko" };

  if (l.tokens.limit != null && l.tokens.percent >= 90) {
    return { texte: `quota à ${l.tokens.percent} %`, ton: "ko" };
  }
  if (l.tokens.limit != null && l.tokens.percent >= 70) {
    return { texte: `quota à ${l.tokens.percent} %`, ton: "attention" };
  }
  if (inactif >= 1) return { texte: `rien depuis ${inactif} j`, ton: "attention" };
  return { texte: "actif", ton: "ok" };
}

const COULEUR = {
  ko:        { fg: "#8A2020", bg: "rgba(220,38,38,0.14)" },
  attention: { fg: "#8A5A00", bg: "rgba(251,191,36,0.18)" },
  ok:        { fg: "#4A6B00", bg: "rgba(198,242,78,0.20)" },
} as const;

export default function AdminPage() {
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [degrade, setDegrade] = useState<string[]>([]);
  const [charge, setCharge] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setCharge(true);
    try {
      const r = await fetch("/api/admin/overview", { headers: { ...authHeaders() }, cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.status === 403) { setErreur("Ce compte n'a pas accès à la console."); setLignes([]); return; }
      if (!r.ok) { setErreur(d.error ?? "Chargement impossible"); setLignes([]); return; }
      setErreur("");
      setDegrade(Array.isArray(d.degraded) ? d.degraded : []);
      setLignes(Array.isArray(d.agents) ? d.agents : []);
    } catch (e) {
      setErreur((e as Error).message);
      setLignes([]);
    } finally { setCharge(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function agir(id: string, corps: Record<string, unknown>, succes: string) {
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(corps),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Échec");
      toast.success(succes);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  }

  const items = lignes ?? [];
  // Les lignes en panne remontent : une console se lit de haut en bas, et ce
  // qui brûle doit être en haut.
  const rang = { ko: 0, attention: 1, ok: 2 } as const;
  const triees = [...items].sort((a, b) => rang[diagnostic(a).ton] - rang[diagnostic(b).ton]);
  const enPanne = items.filter((l) => diagnostic(l).ton === "ko").length;

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text-primary)" }}>
            Console d&apos;exploitation
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {items.length} agent{items.length > 1 ? "s" : ""}
            {enPanne > 0 ? ` · ${enPanne} à regarder tout de suite` : " · rien à signaler"}
          </p>
        </div>
        <button onClick={load} disabled={charge} className="btn-ghost disabled:opacity-60">
          <RefreshCw className={"h-3.5 w-3.5 " + (charge ? "animate-spin" : "")} />
          Actualiser
        </button>
      </div>

      {erreur && (
        <div className="mt-4 flex items-center gap-2 rounded-lg p-3 text-[13px]"
          style={{ background: "rgba(220,38,38,0.10)", color: "#8A2020" }}>
          <ShieldAlert className="h-4 w-4 shrink-0" /> {erreur}
        </div>
      )}

      {degrade.length > 0 && (
        <div className="mt-4 rounded-lg p-3 text-[12px]"
          style={{ background: "rgba(251,191,36,0.14)", color: "#8A5A00" }}>
          Vue partielle — certaines données n&apos;ont pas pu être lues :{" "}
          {degrade.join(" · ")}
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl"
        style={{ border: "1px solid var(--border-default)" }}>
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr style={{ background: "var(--surface-raised)" }}>
              {["Agent", "État", "Plan", "Quota du mois", "7 derniers jours", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[11.5px] font-medium"
                  style={{ color: "var(--text-secondary)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {triees.map((l) => {
              const d = diagnostic(l);
              const c = COULEUR[d.ton];
              return (
                <tr key={l.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {l.business_name || l.name}
                    </div>
                    <div className="text-[11.5px]" style={{ color: "var(--text-disabled)" }}>
                      {l.owner.email} · N{l.level}
                    </div>
                  </td>

                  <td className="px-3 py-2.5">
                    <span className="rounded-md px-2 py-1 text-[11.5px] font-medium"
                      style={{ background: c.bg, color: c.fg }}>
                      {d.texte}
                    </span>
                  </td>

                  <td className="px-3 py-2.5">
                    <select
                      className="input-midnight w-[120px]"
                      value={l.plan}
                      disabled={busy === l.id}
                      onChange={(e) => agir(l.id, { plan: e.target.value }, `Plan passé en ${e.target.value}`)}
                    >
                      {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {l.plan_expires_at && (
                      <div className="mt-1 text-[11px]" style={{ color: l.plan_expired ? "#8A2020" : "var(--text-disabled)" }}>
                        {l.plan_expired ? "expiré le " : "jusqu'au "}
                        {new Date(l.plan_expires_at).toLocaleDateString("fr-FR")}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    {l.tokens.limit == null ? (
                      <span style={{ color: "var(--text-disabled)" }}>illimité</span>
                    ) : (
                      <>
                        <div className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                          {l.tokens.used.toLocaleString("fr-FR")} / {l.tokens.limit.toLocaleString("fr-FR")}
                        </div>
                        <div className="mt-1 h-1.5 w-[120px] overflow-hidden rounded-full"
                          style={{ background: "var(--surface-raised)" }}>
                          <div className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, l.tokens.percent)}%`,
                              background: l.tokens.percent >= 90 ? "#8A2020"
                                : l.tokens.percent >= 70 ? "#8A5A00" : "var(--color-gold, #4A6B00)",
                            }} />
                        </div>
                      </>
                    )}
                  </td>

                  <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {l.messages_7j.toLocaleString("fr-FR")} msg · {l.commandes_7j} cmd
                  </td>

                  <td className="px-3 py-2.5">
                    <button
                      className="btn-ghost disabled:opacity-60"
                      disabled={busy === l.id || !l.session}
                      title={l.session ? "Relancer la session WhatsApp" : "Aucune session"}
                      onClick={() => agir(l.id, { action: "restart_session" }, "Session relancée")}
                    >
                      <RotateCw className={"h-3.5 w-3.5 " + (busy === l.id ? "animate-spin" : "")} />
                      Relancer
                    </button>
                  </td>
                </tr>
              );
            })}

            {lignes !== null && !items.length && !erreur && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center" style={{ color: "var(--text-disabled)" }}>
                  Aucun agent.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11.5px]" style={{ color: "var(--text-disabled)" }}>
        <Check className="mr-1 inline h-3 w-3" />
        Les changements de plan et les relances sont journalisés avec ton adresse.
        <X className="ml-3 mr-1 inline h-3 w-3" />
        Le quota se lit sur le mois en cours.
      </p>
    </div>
  );
}
