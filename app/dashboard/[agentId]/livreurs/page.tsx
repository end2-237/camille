"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Livreurs — déléguer la course sans ouvrir la boutique.
//
// Le livreur ouvre son compte Camille, y trouve un code, et vous le donne.
// Vous le collez ici : il est rattaché. Son écran ne montrera que les commandes
// mises en livraison, leur trajet, et le bouton qui les marque livrées.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authHeaders } from "@/lib/auth-client";
import { toast } from "sonner";
import { Bike, Loader2, MapPin, Plus, RefreshCw, Trash2 } from "lucide-react";

type Courier = {
  id: string; name: string; full_name: string | null; email: string;
  phone: string | null; status: "active" | "suspended";
  delivered: number; en_cours: number;
  last_lat: number | null; last_lng: number | null; last_seen_at: string | null;
};

const when = (v: string | null) =>
  v ? new Date(v).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** « il y a 4 min » : c'est ce qui dit si le livreur est en route maintenant. */
function ago(v: string | null) {
  if (!v) return null;
  const m = Math.floor((Date.now() - new Date(v).getTime()) / 60000);
  if (m < 2) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`;
}

export default function LivreursPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [warning, setWarning] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/agents/${agentId}/couriers`, { headers: { ...authHeaders() } });
      const d = await r.json();
      setWarning(d.error || "");
      setCouriers(d.couriers ?? []);
    } catch (e) {
      setWarning((e as Error).message);
      setCouriers([]);
    }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  // Un livreur en course bouge : la page se rafraîchit toute seule.
  useEffect(() => {
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [load]);

  async function add() {
    if (!code.trim()) return toast.error("Colle le code que le livreur t'a donné.");
    setBusy(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/couriers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Rattachement impossible");
      toast.success(`${d.courier.name} est rattaché à la boutique.`);
      setCode("");
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function change(c: Courier, body: Record<string, unknown>, message: string) {
    const r = await fetch(`/api/agents/${agentId}/couriers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ id: c.id, ...body }),
    });
    if (r.ok) { toast.success(message); load(); }
  }

  async function remove(c: Courier) {
    if (!confirm(`Détacher ${c.name} de la boutique ?`)) return;
    const r = await fetch(`/api/agents/${agentId}/couriers`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ id: c.id }),
    });
    if (r.ok) { toast.success("Livreur détaché."); load(); }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-bold tracking-[-0.02em]">
            <Bike className="h-6 w-6" /> Livreurs
          </h1>
          <p className="mt-1.5 max-w-[620px] text-[13.5px] leading-relaxed text-[var(--cl-sub)]">
            Le livreur crée son compte Camille, y trouve son code, et vous le donne. Une fois
            rattaché, il ne voit que les commandes mises en livraison : leur trajet, et le bouton
            qui les marque livrées. Ni catalogue, ni chiffre d&apos;affaires, ni fiches clients.
          </p>
        </div>
        <button onClick={load}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--cl-line)] bg-white px-4 text-[12.5px] font-semibold">
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </header>

      {warning && (
        <div className="mt-5 rounded-2xl border border-[#F3D5A5] bg-[#FDF7E7] p-4 text-[13px] text-[#8A5A00]">{warning}</div>
      )}

      <section className="mt-5 rounded-2xl border border-[var(--cl-line)] bg-white p-5">
        <h2 className="text-[14px] font-semibold">Rattacher un livreur</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="LIV-7K2M"
            className="input-midnight flex-1 min-w-[180px] font-mono tracking-[0.08em]"
          />
          <button onClick={add} disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#101012] px-5 text-[12.5px] font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Rattacher
          </button>
        </div>
        <p className="mt-2 text-[12px] text-[var(--cl-sub)]">
          Le livreur trouve son code sur <code>/livraison</code>, une fois connecté à son compte.
        </p>
      </section>

      {couriers === null ? (
        <p className="mt-6 text-[13.5px] text-[var(--cl-sub)]">Chargement…</p>
      ) : couriers.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--cl-line)] p-8 text-center text-[13.5px] text-[var(--cl-sub)]">
          Aucun livreur rattaché. Vous livrez vous-même, et les commandes restent dans « Commandes ».
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {couriers.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--cl-line)] bg-white p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F5]">
                <Bike className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[15px]">{c.name}</strong>
                  {c.status === "suspended" && (
                    <span className="rounded-full bg-[#FDECEC] px-2.5 py-0.5 text-[10.5px] font-bold text-[#c0392b]">SUSPENDU</span>
                  )}
                  {c.en_cours > 0 && (
                    <span className="rounded-full bg-[#E7F0FD] px-2.5 py-0.5 text-[10.5px] font-bold text-[#1D4ED8]">
                      {c.en_cours} EN COURS
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--cl-sub)]">
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ""}
                  {` · ${c.delivered} livraison(s)`}
                </div>
                {c.last_seen_at && (
                  <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[var(--cl-sub)]">
                    <MapPin className="h-3 w-3" />
                    Dernière position {ago(c.last_seen_at)}
                    {c.last_lat != null && c.last_lng != null && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${c.last_lat}&mlon=${c.last_lng}#map=16/${c.last_lat}/${c.last_lng}`}
                        target="_blank" rel="noreferrer"
                        className="underline"
                      >
                        voir sur la carte
                      </a>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => change(c, { status: c.status === "active" ? "suspended" : "active" },
                  c.status === "active" ? "Livreur suspendu" : "Livreur réactivé")}
                className="rounded-full border border-[var(--cl-line)] px-4 py-2 text-[12.5px] font-semibold"
                style={{ color: c.status === "active" ? "#c0392b" : "#0e6b45" }}>
                {c.status === "active" ? "Suspendre" : "Réactiver"}
              </button>
              <button onClick={() => remove(c)} aria-label="Détacher"
                className="rounded-full border border-[var(--cl-line)] p-2 text-[var(--cl-sub)]">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <p className="text-[12px] text-[var(--cl-sub)]">
            Le suivi de position n&apos;est enregistré que pendant une course, et seule la dernière
            position est conservée : suivre un livreur à la trace toute la journée n&apos;apporterait
            rien à la livraison.
          </p>
        </div>
      )}
    </div>
  );
}
