"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Comptes entreprise — un code par société, partagé à ses employés.
//
// Une entreprise cliente reçoit ici son code. Ses employés le saisissent en
// commandant depuis le site : leurs commandes se rattachent au compte, la
// provision se décompte (ou le relevé s'accumule), et le commerçant sait à
// tout moment qui a consommé quoi.
//
// Rien de propre à un métier : c'est un compte client d'entreprise.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authHeaders } from "@/lib/auth-client";
import { toast } from "sonner";
import { Building2, Check, Copy, Loader2, Plus, RefreshCw, Wallet, X } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Company = {
  id: string; code: string; name: string;
  contact_name: string | null; contact_phone: string | null; email: string | null;
  address: string | null; details: string | null;
  billing_mode: "prepaid" | "monthly";
  balance: number; monthly_cap: number | null; currency: string;
  status: "active" | "suspended"; note: string | null;
  month_to_date?: number; orders_this_month?: number; employees?: number;
};

const money = (n: unknown, cur = "XAF") => `${Number(n || 0).toLocaleString("fr-FR")} ${cur}`;
const when = (v?: string | null) =>
  v ? new Date(v).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function EntreprisesPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [warning, setWarning] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ name: "", contact_name: "", contact_phone: "", address: "", billing_mode: "prepaid", monthly_cap: "" });

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/agents/${agentId}/companies`, { headers: { ...authHeaders() } });
      const d = await r.json();
      setWarning(d.error || "");
      setCompanies(Array.isArray(d.companies) ? d.companies : []);
    } catch (e) {
      setWarning((e as Error).message);
      setCompanies([]);
    }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!form.name.trim()) return toast.error("Le nom de l'entreprise est obligatoire.");
    setBusy(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...form, monthly_cap: form.monthly_cap || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Création impossible");
      toast.success(`Compte ouvert — code ${d.company.code}`);
      setCreating(false);
      setForm({ name: "", contact_name: "", contact_phone: "", address: "", billing_mode: "prepaid", monthly_cap: "" });
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  const total = (companies ?? []).reduce((s, c) => s + (c.billing_mode === "prepaid" ? c.balance : 0), 0);
  const consomme = (companies ?? []).reduce((s, c) => s + (c.month_to_date ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">Comptes entreprise</h1>
          <p className="mt-1.5 max-w-[600px] text-[13.5px] leading-relaxed text-[var(--cl-sub)]">
            Chaque entreprise cliente reçoit un code, qu&apos;elle partage à ses employés. Ils le
            saisissent en commandant : la commande est rattachée au compte, et vous savez qui
            consomme quoi.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--cl-line)] bg-white px-4 text-[12.5px] font-semibold">
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </button>
          <button onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#101012] px-5 text-[12.5px] font-semibold text-white">
            <Plus className="h-4 w-4" /> Ouvrir un compte
          </button>
        </div>
      </header>

      {warning && (
        <div className="mt-5 rounded-2xl border border-[#F3D5A5] bg-[#FDF7E7] p-4 text-[13px] text-[#8A5A00]">{warning}</div>
      )}

      {!!companies?.length && (
        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <Kpi label="Comptes actifs" value={String(companies.filter((c) => c.status === "active").length)} />
          <Kpi label="Provisions en caisse" value={money(total)} hint="comptes prépayés" />
          <Kpi label="Consommé ce mois" value={money(consomme)} accent />
        </section>
      )}

      {creating && (
        <section className="mt-5 rounded-2xl border border-[var(--cl-line)] bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Nouveau compte entreprise</h2>
            <button onClick={() => setCreating(false)} className="text-[var(--cl-sub)]"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Nom de l'entreprise *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Enko Education" />
            <Field label="Interlocuteur" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} placeholder="Mme Ndongo, office manager" />
            <Field label="Téléphone" value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} placeholder="237699112233" />
            <Field label="Adresse de livraison" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="Bonapriso, immeuble X" />
            <label className="block">
              <span className="text-[11.5px] font-medium text-[var(--cl-sub)]">Régime de paiement</span>
              <select value={form.billing_mode} onChange={(e) => setForm({ ...form, billing_mode: e.target.value })}
                className="input-midnight mt-1 w-full">
                <option value="prepaid">Prépayé — l&apos;entreprise verse d&apos;avance</option>
                <option value="monthly">Mensuel — réglé en fin de mois</option>
              </select>
            </label>
            {form.billing_mode === "monthly" && (
              <Field label="Plafond mensuel (facultatif)" value={form.monthly_cap} onChange={(v) => setForm({ ...form, monthly_cap: v })} placeholder="500000" />
            )}
          </div>
          <p className="mt-3 text-[12px] text-[var(--cl-sub)]">
            Le code est tiré à l&apos;ouverture du compte. C&apos;est lui que les employés saisiront.
          </p>
          <button onClick={create} disabled={busy}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[#101012] px-5 text-[12.5px] font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Ouvrir le compte
          </button>
        </section>
      )}

      {companies === null ? (
        <p className="mt-6 text-[13.5px] text-[var(--cl-sub)]">Chargement…</p>
      ) : companies.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--cl-line)] p-8 text-center text-[13.5px] text-[var(--cl-sub)]">
          Aucun compte entreprise pour le moment.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {companies.map((c) => <Card key={c.id} company={c} onOpen={() => setOpen(c)} />)}
        </div>
      )}

      {open && (
        <Detail agentId={agentId} company={open} onClose={() => setOpen(null)} onChanged={() => { load(); }} />
      )}
    </div>
  );
}

function Card({ company: c, onOpen }: { company: Company; onOpen: () => void }) {
  const [copied, setCopied] = useState(false);
  const prepaid = c.billing_mode === "prepaid";
  const low = prepaid && c.balance <= 0;

  return (
    <div className="rounded-2xl border border-[var(--cl-line)] bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F5]">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-[15px]">{c.name}</strong>
            <button
              onClick={() => { navigator.clipboard?.writeText(c.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#101012] px-2.5 py-1 font-mono text-[11.5px] font-bold text-[#C6F24E]"
              title="Copier le code à donner aux employés"
            >
              {c.code} {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
            {c.status === "suspended" && (
              <span className="rounded-full bg-[#FDECEC] px-2.5 py-1 text-[10.5px] font-bold text-[#c0392b]">SUSPENDU</span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-[var(--cl-sub)]">
            {prepaid ? "Prépayé" : "Réglé en fin de mois"}
            {c.employees ? ` · ${c.employees} employé(s) ont commandé` : ""}
            {c.orders_this_month ? ` · ${c.orders_this_month} commande(s) ce mois` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[16px] font-bold ${low ? "text-[#c0392b]" : ""}`}>
            {prepaid ? money(c.balance, c.currency) : money(c.month_to_date ?? 0, c.currency)}
          </div>
          <div className="text-[11px] text-[var(--cl-sub)]">{prepaid ? "provision restante" : "à régler ce mois"}</div>
        </div>
        <button onClick={onOpen}
          className="rounded-full border border-[var(--cl-line)] px-4 py-2 text-[12.5px] font-semibold">
          Gérer
        </button>
      </div>
    </div>
  );
}

function Detail({ agentId, company, onClose, onChanged }: {
  agentId: string; company: Company; onClose: () => void; onChanged: () => void;
}) {
  const [data, setData] = useState<{ company: Company; ledger: any[]; orders: any[] } | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/agents/${agentId}/companies/${company.id}`, { headers: { ...authHeaders() } });
    const d = await r.json();
    if (!r.ok) return toast.error(d.error || "Chargement impossible");
    setData(d);
  }, [agentId, company.id]);

  useEffect(() => { load(); }, [load]);

  async function credit() {
    const n = Number(amount.replace(/\s/g, ""));
    if (!Number.isFinite(n) || n <= 0) return toast.error("Montant invalide.");
    setBusy(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/companies/${company.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ amount: n, label: "Versement" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Versement enregistré — nouveau solde ${money(d.balance, company.currency)}`);
      setAmount(""); load(); onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function patch(body: Record<string, unknown>, message: string) {
    const r = await fetch(`/api/agents/${agentId}/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (r.ok) { toast.success(message); load(); onChanged(); }
  }

  const c = data?.company ?? company;
  const prepaid = c.billing_mode === "prepaid";

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(16,16,18,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="w-full max-w-[640px] overflow-auto rounded-2xl bg-white" style={{ maxHeight: "90vh" }}>
        <div className="sticky top-0 flex items-center gap-3 border-b border-[var(--cl-line)] bg-white px-5 py-4">
          <strong className="text-[16px]">{c.name}</strong>
          <span className="rounded-full bg-[#101012] px-2.5 py-1 font-mono text-[11.5px] font-bold text-[#C6F24E]">{c.code}</span>
          <div className="flex-1" />
          <button onClick={onClose} className="text-[var(--cl-sub)]"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Kpi label={prepaid ? "Provision restante" : "À régler ce mois"}
              value={money(prepaid ? c.balance : c.month_to_date ?? 0, c.currency)} accent />
            <Kpi label="Consommé ce mois" value={money(c.month_to_date ?? 0, c.currency)}
              hint={`${c.orders_this_month ?? 0} commande(s)`} />
          </div>

          {/* Versement : c'est ce geste qui rend le prépaiement réel. */}
          <div className="rounded-xl border border-[var(--cl-line)] p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold"><Wallet className="h-4 w-4" /> Enregistrer un versement</div>
            <div className="mt-3 flex gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100000"
                className="input-midnight flex-1" />
              <button onClick={credit} disabled={busy}
                className="rounded-lg bg-[#101012] px-4 text-[12.5px] font-semibold text-white disabled:opacity-60">
                {busy ? "…" : "Créditer"}
              </button>
            </div>
            <p className="mt-2 text-[11.5px] text-[var(--cl-sub)]">
              Chaque mouvement est inscrit au grand livre : le solde reste explicable, versement par versement.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => patch({ billing_mode: prepaid ? "monthly" : "prepaid" }, "Régime de paiement modifié")}
              className="rounded-full border border-[var(--cl-line)] px-4 py-2 text-[12.5px] font-semibold">
              Passer en {prepaid ? "paiement mensuel" : "prépayé"}
            </button>
            <button onClick={() => patch({ status: c.status === "active" ? "suspended" : "active" }, c.status === "active" ? "Compte suspendu" : "Compte réactivé")}
              className="rounded-full border border-[var(--cl-line)] px-4 py-2 text-[12.5px] font-semibold"
              style={{ color: c.status === "active" ? "#c0392b" : "#0e6b45" }}>
              {c.status === "active" ? "Suspendre le compte" : "Réactiver le compte"}
            </button>
          </div>

          <Section title="Mouvements">
            {(data?.ledger ?? []).length === 0 ? (
              <p className="text-[13px] text-[var(--cl-sub)]">Aucun mouvement.</p>
            ) : (
              <ul className="space-y-1.5">
                {data!.ledger.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">
                      {m.label || (m.kind === "credit" ? "Versement" : "Commande")}
                      <span className="text-[var(--cl-sub)]"> · {when(m.created_at)}</span>
                    </span>
                    <span className="shrink-0 font-semibold" style={{ color: m.kind === "credit" ? "#0e6b45" : "#c0392b" }}>
                      {m.kind === "credit" ? "+" : "−"} {money(m.amount, c.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Commandes des employés">
            {(data?.orders ?? []).length === 0 ? (
              <p className="text-[13px] text-[var(--cl-sub)]">Aucune commande rattachée à ce compte.</p>
            ) : (
              <ul className="space-y-1.5">
                {data!.orders.map((o) => (
                  <li key={o.ref} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">
                      n° {o.ref} · {o.customer_name || o.contact_phone}
                      <span className="text-[var(--cl-sub)]"> · {when(o.created_at)}</span>
                    </span>
                    <span className="shrink-0 font-semibold">{money(o.total, o.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.4px] text-[var(--cl-sub)]">{title}</div>
      <div className="rounded-xl border border-[var(--cl-line)] p-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-medium text-[var(--cl-sub)]">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input-midnight mt-1 w-full" />
    </label>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--cl-line)", background: accent ? "#101012" : "#fff" }}>
      <div className="text-[11.5px] font-semibold" style={{ color: accent ? "rgba(255,255,255,.6)" : "var(--cl-sub)" }}>{label}</div>
      <div className="mt-1 text-[22px] font-bold" style={{ color: accent ? "#C6F24E" : "var(--cl-ink)" }}>{value}</div>
      {hint && <div className="mt-0.5 text-[11.5px]" style={{ color: accent ? "rgba(255,255,255,.5)" : "var(--cl-sub)" }}>{hint}</div>}
    </div>
  );
}
