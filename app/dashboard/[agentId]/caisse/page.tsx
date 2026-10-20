// ─────────────────────────────────────────────────────────────────────────────
// app/dashboard/[agentId]/caisse/page.tsx
//
// La caisse : une vente au comptoir en trois touches. Le stock baisse, le
// catalogue WhatsApp suit, et la vente compte dans le chiffre du jour — plus
// de double saisie entre la boutique et WhatsApp.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Minus, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-client";
import { Bouton, Squelettes, StylesUI, Vide } from "@/components/dashboard/ui";

type Produit = { id: string; name: string; price: number | null; currency?: string; stock: number | null; image_url?: string | null; active?: boolean };

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
const PAIEMENTS = [
  { v: "especes", l: "Espèces" },
  { v: "momo", l: "MTN MoMo" },
  { v: "om", l: "Orange Money" },
];

export default function CaissePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [produits, setProduits] = useState<Produit[] | null>(null);
  const [q, setQ] = useState("");
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [paiement, setPaiement] = useState("especes");
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    try {
      const d = await (await fetch(`/api/agents/${agentId}/products`, { headers: { ...authHeaders() } })).json();
      setProduits((Array.isArray(d.products) ? d.products : []).filter((p: Produit) => p.active !== false));
    } catch {
      setProduits([]);
    }
  }, [agentId]);
  useEffect(() => { charger(); }, [charger]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (produits || []).filter((p) => !t || p.name.toLowerCase().includes(t));
  }, [produits, q]);

  const lignes = Object.entries(panier)
    .map(([id, qty]) => ({ p: (produits || []).find((x) => x.id === id)!, qty }))
    .filter((l) => l.p && l.qty > 0);
  const total = lignes.reduce((t, l) => t + (Number(l.p.price) || 0) * l.qty, 0);

  const ajouter = (id: string, d = 1) =>
    setPanier((p) => {
      const n = Math.max(0, (p[id] || 0) + d);
      const s = { ...p, [id]: n };
      if (!n) delete s[id];
      return s;
    });

  async function encaisser() {
    if (!lignes.length) return;
    setOccupe(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/caisse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ lignes: lignes.map((l) => ({ productId: l.p.id, qty: l.qty })), paiement }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || "Vente non enregistrée");
      toast.success(`Vente ${d.ref} enregistrée — ${fcfa(d.total)}`);
      if (Array.isArray(d.bas) && d.bas.length) toast.warning(`Stock bas : ${d.bas.map((b: { name: string }) => b.name).join(", ")}`);
      setPanier({});
      charger();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="py-6 lg:py-8">
      <StylesUI />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cl-ink-faint)" }} />
            <input className="ui-champ w-full pl-10" placeholder="Chercher un article…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="mt-4">
            {produits === null ? (
              <Squelettes n={4} hauteur={80} />
            ) : visibles.length === 0 ? (
              <Vide doodle="unboxing" titre="Aucun article." texte="Ajoutez vos articles dans le catalogue, ou importez votre fichier Excel." />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {visibles.map((p) => {
                  const epuise = p.stock != null && p.stock <= (panier[p.id] || 0);
                  return (
                    <li key={p.id}>
                      <button disabled={epuise} onClick={() => ajouter(p.id)}
                        className="ui-carte flex w-full flex-col overflow-hidden rounded-[20px] text-left disabled:opacity-50">
                        {p.image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={p.image_url} alt="" className="h-28 w-full object-cover" />
                          : <span className="h-28 w-full" style={{ background: "#F1EFF4" }} />}
                        <span className="p-3">
                          <span className="line-clamp-2 block text-[13.5px] font-medium" style={{ color: "var(--cl-ink)" }}>{p.name}</span>
                          <span className="mt-1 flex justify-between text-[12px]" style={{ color: "var(--cl-ink-faint)" }}>
                            <span>{fcfa(Number(p.price) || 0)}</span>
                            {p.stock != null && <span>{p.stock} en stock</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className="ui-carte h-fit rounded-[28px] p-5 lg:sticky lg:top-[96px]">
          <p className="flex items-center gap-2 text-[16px] font-medium" style={{ color: "var(--cl-ink)" }}>
            <ShoppingBag className="h-4 w-4" /> Vente en cours
          </p>
          {lignes.length === 0 ? (
            <p className="mt-3 text-[13px]" style={{ color: "var(--cl-ink-faint)" }}>Touchez un article pour l&apos;ajouter.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {lignes.map(({ p, qty }) => (
                <li key={p.id} className="flex items-center gap-2 text-[13.5px]">
                  <span className="min-w-0 flex-1 truncate" style={{ color: "var(--cl-ink)" }}>{p.name}</span>
                  <button aria-label="Moins" onClick={() => ajouter(p.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "#F4F2F7" }}>
                    {qty === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  </button>
                  <span className="w-5 text-center tabular-nums">{qty}</span>
                  <button aria-label="Plus" disabled={p.stock != null && qty >= p.stock} onClick={() => ajouter(p.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40" style={{ background: "#F4F2F7" }}>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {PAIEMENTS.map((m) => (
              <button key={m.v} onClick={() => setPaiement(m.v)} className="rounded-full px-3.5 py-1.5 text-[12.5px]"
                style={paiement === m.v ? { background: "var(--cl-ink)", color: "#fff" } : { background: "#F4F2F7", color: "var(--cl-ink)" }}>
                {m.l}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t pt-3" style={{ borderColor: "var(--cl-line-soft)" }}>
            <span className="text-[14px]" style={{ color: "var(--cl-ink)" }}>Total</span>
            <span className="text-[22px] font-semibold tabular-nums" style={{ color: "var(--cl-ink)" }}>{fcfa(total)}</span>
          </div>
          <Bouton variante="encre" className="mt-4 w-full justify-center" occupe={occupe} disabled={occupe || !lignes.length} onClick={encaisser}>
            Encaisser
          </Bouton>
        </aside>
      </div>
    </div>
  );
}
