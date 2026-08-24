"use client";

// ─────────────────────────────────────────────────────────────────────────────
// L'écran du livreur.
//
// C'est tout ce qu'un compte livreur voit de Camille : les courses parties, et
// rien d'autre. Pas de catalogue, pas de chiffre d'affaires, pas de fiches
// clients — et ce n'est pas qu'une affaire d'affichage : chaque route du
// serveur vérifie le rattachement avant de répondre.
//
// Tant qu'aucun commerçant ne l'a rattaché, le livreur voit son code : c'est
// ce qu'il donne pour être ajouté.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authHeaders, getStoredToken } from "@/lib/auth-client";
import { toast } from "sonner";
import CourierRide, { type Ride } from "@/components/CourierRide";
import { Bike, Check, Copy, Loader2, MapPin, Package, RefreshCw } from "lucide-react";

const money = (n: number, c: string) => `${Number(n || 0).toLocaleString("fr-FR")} ${c || "XAF"}`;
const heure = (v: string | null) =>
  v ? new Date(v).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;

export default function LivraisonPage() {
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<Ride[] | null>(null);
  const [missions, setMissions] = useState<{ agent_id: string; shop: string }[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [warning, setWarning] = useState("");
  const [open, setOpen] = useState<Ride | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setConnecte(Boolean(getStoredToken())), []);

  const load = useCallback(async () => {
    if (!getStoredToken()) return;
    setBusy(true);
    try {
      const [c, o] = await Promise.all([
        fetch("/api/me/courier", { headers: { ...authHeaders() } }).then((r) => r.json()),
        fetch("/api/courier/orders", { headers: { ...authHeaders() } }).then((r) => r.json()),
      ]);
      setCode(c.code ?? null);
      setMissions(o.missions ?? c.missions ?? []);
      setOrders(o.orders ?? []);
      setWarning(o.error || c.error || "");
    } catch (e) {
      setWarning((e as Error).message);
      setOrders([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Une course peut partir pendant qu'on regarde la liste : on la rafraîchit
  // doucement, sans occuper la connexion du livreur.
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (connecte === false) {
    return (
      <Ecran>
        <h1 className="text-[22px] font-bold">Espace livreur</h1>
        <p className="mt-2 text-[13.5px] text-[var(--cl-sub)]">
          Connecte-toi avec ton compte Camille pour voir tes courses.
        </p>
        <Link href="/login"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-[#101012] px-6 text-[13.5px] font-semibold text-white">
          Se connecter
        </Link>
      </Ecran>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-bold tracking-[-0.02em]">
            <Bike className="h-5 w-5" /> Mes courses
          </h1>
          <p className="mt-1 text-[13px] text-[var(--cl-sub)]">
            {missions.length
              ? missions.map((m) => m.shop).join(" · ")
              : "Aucune boutique ne t'a encore rattaché."}
          </p>
        </div>
        <button onClick={load}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--cl-line)] bg-white px-4 text-[12.5px] font-semibold">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Actualiser
        </button>
      </header>

      {warning && (
        <div className="mt-4 rounded-2xl border border-[#F3D5A5] bg-[#FDF7E7] p-4 text-[13px] text-[#8A5A00]">{warning}</div>
      )}

      {/* Le code : ce que le livreur donne au commerçant pour être ajouté. */}
      {code && (
        <section className="mt-4 rounded-2xl border border-[var(--cl-line)] bg-white p-4">
          <h2 className="text-[13.5px] font-semibold">Ton code livreur</h2>
          <p className="mt-1 text-[12.5px] leading-snug text-[var(--cl-sub)]">
            Donne-le au commerçant : il le colle dans son tableau de bord et tes courses
            apparaissent ici.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-[var(--cl-bg-soft)] px-3 py-2.5 font-mono text-[17px] font-bold tracking-[0.1em]">
              {code}
            </code>
            <button
              onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[var(--cl-line)] px-4 text-[12.5px] font-semibold">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
        </section>
      )}

      {orders === null ? (
        <p className="mt-6 text-[13.5px] text-[var(--cl-sub)]">Chargement…</p>
      ) : orders.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--cl-line)] p-8 text-center">
          <Package className="mx-auto h-6 w-6 text-[var(--cl-sub)]" />
          <p className="mt-3 text-[13.5px] font-semibold">Aucune course en attente</p>
          <p className="mt-1 text-[12.5px] text-[var(--cl-sub)]">
            Les commandes apparaissent ici dès que le commerçant les met en livraison.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {orders.map((o) => (
            <button key={o.id} onClick={() => setOpen(o)}
              className="rounded-2xl border border-[var(--cl-line)] bg-white p-4 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-[15px]">n° {o.ref}</strong>
                {o.mine && (
                  <span className="rounded-full bg-[#E7F0FD] px-2.5 py-0.5 text-[10.5px] font-bold text-[#1D4ED8]">PRISE</span>
                )}
                {o.scheduled_at && (
                  <span className="rounded-full bg-[#FDF1DC] px-2.5 py-0.5 text-[10.5px] font-bold text-[#8A5A00]">
                    POUR {heure(o.scheduled_at)}
                  </span>
                )}
                <span className="ml-auto text-[13.5px] font-bold">{money(o.total, o.currency)}</span>
              </div>
              <p className="mt-1.5 text-[13.5px] font-semibold">
                {o.customer_name || "Client"}{o.company ? ` · ${o.company}` : ""}
              </p>
              <p className="mt-0.5 flex items-start gap-1.5 text-[12.5px] text-[var(--cl-sub)]">
                <MapPin className="mt-[2px] h-3.5 w-3.5 shrink-0" />
                {o.address || "Adresse non précisée"}
              </p>
              <p className="mt-2 text-[12px] text-[var(--cl-sub)]">
                {o.items_count} article(s) · {o.shop}
                {o.payment_method ? ` · ${o.payment_method}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      {open && (
        <CourierRide
          ride={open}
          onClose={() => setOpen(null)}
          onDelivered={(id) => {
            setOrders((list) => (list ?? []).filter((r) => r.id !== id));
            setOpen(null);
            toast.success("Course terminée.");
          }}
        />
      )}
    </div>
  );
}

function Ecran({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-[520px] flex-col items-center justify-center px-4 text-center">
      {children}
    </div>
  );
}
