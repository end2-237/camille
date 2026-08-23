"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Clientèle — qui achète, combien, et depuis quand.
//
// Ces fiches existaient déjà : elles se remplissent toutes seules, par la
// conversation WhatsApp et par les commandes du site. Aucun écran ne les
// montrait, donc le marchand ne pouvait ni retrouver un client, ni voir ce
// qu'il avait déjà commandé avant de le rappeler.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { authHeaders } from "@/lib/auth-client";
import { Building2, MessageCircle, RefreshCw, Search, Users } from "lucide-react";

type Customer = {
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  addresses: { label?: string; address?: string; details?: string }[];
  orders: number;
  spent: number;
  last_order: string | null;
  last_ref: string | null;
};

const money = (n: number) => `${Number(n || 0).toLocaleString("fr-FR")} XAF`;
const when = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";

// WhatsApp adresse parfois les contacts par LID : un identifiant interne, pas
// un numéro. Un lien wa.me construit dessus est mort.
const joignable = (p: string) => /^\d{8,14}$/.test(p);

export default function ClientelePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [totals, setTotals] = useState({ clients: 0, orders: 0, spent: 0 });
  const [warning, setWarning] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/customers`, { headers: { ...authHeaders() } });
      const d = await r.json();
      setWarning(d.error || "");
      setCustomers(d.customers ?? []);
      setTotals(d.totals ?? { clients: 0, orders: 0, spent: 0 });
    } catch (e) {
      setWarning((e as Error).message);
      setCustomers([]);
    } finally {
      setBusy(false);
    }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers ?? [];
    return (customers ?? []).filter((c) =>
      [c.phone, c.name, c.company, c.email].some((v) => String(v ?? "").toLowerCase().includes(needle))
    );
  }, [customers, q]);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">Clientèle</h1>
          <p className="mt-1.5 max-w-[600px] text-[13.5px] leading-relaxed text-[var(--cl-sub)]">
            Les personnes qui ont écrit ou commandé, réunies sur leur numéro. La fiche se
            remplit toute seule : conversation WhatsApp d&apos;un côté, commandes du site de
            l&apos;autre.
          </p>
        </div>
        <button onClick={load}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--cl-line)] bg-white px-4 text-[12.5px] font-semibold">
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </header>

      {warning && (
        <div className="mt-5 rounded-2xl border border-[#F3D5A5] bg-[#FDF7E7] p-4 text-[13px] text-[#8A5A00]">{warning}</div>
      )}

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <Kpi label="Clients" value={String(totals.clients)} icon={<Users className="h-4 w-4" />} />
        <Kpi label="Commandes" value={String(totals.orders)} />
        <Kpi label="Chiffre d'affaires" value={money(totals.spent)} accent />
      </section>

      <div className="mt-5 flex h-11 items-center gap-2 rounded-full border border-[var(--cl-line)] bg-white px-4">
        <Search className="h-4 w-4 text-[var(--cl-sub)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher un nom, un numéro, une entreprise…"
          className="h-full w-full bg-transparent text-[13.5px] outline-none" />
      </div>

      {customers === null ? (
        <p className="mt-6 text-[13.5px] text-[var(--cl-sub)]">Chargement…</p>
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--cl-line)] p-8 text-center text-[13.5px] text-[var(--cl-sub)]">
          {q ? "Personne ne correspond à cette recherche." : "Aucun client pour le moment."}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--cl-line)] bg-white">
          {list.map((c, i) => (
            <div key={c.phone}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--cl-line)" }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[14px]">{c.name || c.phone}</strong>
                  {c.company && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-semibold text-[var(--cl-sub)]">
                      <Building2 className="h-3 w-3" /> {c.company}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--cl-sub)]">
                  {c.phone}
                  {c.email ? ` · ${c.email}` : ""}
                  {c.addresses[0]?.address ? ` · ${c.addresses[0].address}` : ""}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[13.5px] font-bold">{money(c.spent)}</div>
                <div className="text-[11.5px] text-[var(--cl-sub)]">
                  {c.orders} commande(s) · dernière {when(c.last_order)}
                </div>
              </div>

              {joignable(c.phone) && (
                <a href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F8EC] px-3 py-2 text-[12px] font-bold text-[#0e6b45]">
                  <MessageCircle className="h-3.5 w-3.5" /> Écrire
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, accent, icon }: {
  label: string; value: string; hint?: string; accent?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--cl-line)", background: accent ? "#101012" : "#fff" }}>
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold"
        style={{ color: accent ? "rgba(255,255,255,.6)" : "var(--cl-sub)" }}>
        {icon} {label}
      </div>
      <div className="mt-1 text-[22px] font-bold" style={{ color: accent ? "#C6F24E" : "var(--cl-ink)" }}>{value}</div>
      {hint && <div className="mt-0.5 text-[11.5px]" style={{ color: accent ? "rgba(255,255,255,.5)" : "var(--cl-sub)" }}>{hint}</div>}
    </div>
  );
}
