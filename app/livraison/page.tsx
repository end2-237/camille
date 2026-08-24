"use client";

// ─────────────────────────────────────────────────────────────────────────────
// L'écran du livreur.
//
// Exactement le suivi du vendeur — la même pile d'expéditions, la même carte —
// avec les gestes du métier à la place du bloc « livreur » : démarrer la
// course, appeler le client, confirmer la remise.
//
// C'est tout ce qu'un compte livreur voit de Camille : les courses parties, et
// rien d'autre. Ce n'est pas qu'un écran allégé — chaque route du serveur
// vérifie le rattachement avant de répondre.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { authHeaders, getStoredToken } from "@/lib/auth-client";
import { toast } from "sonner";
import {
  Check, Copy, LayoutDashboard, Loader2, MessageCircle, Navigation, Phone, Play, Square,
} from "lucide-react";
import {
  BlocLivraison, Carte, Ecran, EnTete, GRIS, GRIS_PALE, Ligne, Rien, VIOLET,
  heure, jour, type Etape,
} from "@/components/tracking";

const TrackingMap = dynamic(() => import("@/components/TrackingMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full" style={{ background: "#EDEDF2" }} />,
});

type Point = { lat: number; lng: number };
type Course = {
  id: string; ref: string; agent_id: string; shop: string; shop_location: string | null;
  status: string; total: number; currency: string; items_count: number;
  customer_name: string | null; phone: string; address: string | null;
  note: string | null; company: string | null; payment_method: string | null;
  lat: number | null; lng: number | null; shop_lat: number | null; shop_lng: number | null;
  scheduled_at: string | null; dispatched_at: string | null; picked_up_at: string | null;
  created_at?: string; mine: boolean;
};

/** À vol d'oiseau : sert à décider s'il faut redemander une route. */
function metres(a: Point, b: Point) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Le fil des étapes d'une course, avec ce que le livreur en connaît. */
function etapes(c: Course): Etape[] {
  return [
    { at: c.dispatched_at ?? "", label: "Commande partie en livraison", kind: "road" },
    { at: c.picked_up_at ?? "", label: "Course prise en charge", kind: "hand" },
    { at: c.created_at ?? "", label: "Commande reçue", kind: "new" },
  ].filter((e) => e.at);
}

export default function LivraisonPage() {
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [missions, setMissions] = useState<{ agent_id: string; shop: string }[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [warning, setWarning] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("");
  const [trajet, setTrajet] = useState<Point[]>([]);
  const [moi, setMoi] = useState<Point | null>(null);
  const [enRoute, setEnRoute] = useState(false);
  const [busy, setBusy] = useState(false);

  const watchId = useRef<number | null>(null);
  const envoye = useRef(0);
  const calcule = useRef<Point | null>(null);

  useEffect(() => setConnecte(Boolean(getStoredToken())), []);

  const charger = useCallback(async () => {
    if (!getStoredToken()) return;
    try {
      const [c, o] = await Promise.all([
        fetch("/api/me/courier", { headers: { ...authHeaders() } }).then((r) => r.json()),
        fetch("/api/courier/orders", { headers: { ...authHeaders() } }).then((r) => r.json()),
      ]);
      setCode(c.code ?? null);
      setMissions(o.missions ?? c.missions ?? []);
      setCourses(o.orders ?? []);
      setWarning(o.error || c.error || "");
      setOuvert((v) => v ?? (o.orders ?? [])[0]?.id ?? null);
    } catch (e) {
      setWarning((e as Error).message);
      setCourses([]);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Une commande peut partir pendant qu'on roule.
  useEffect(() => {
    const t = setInterval(charger, 60_000);
    return () => clearInterval(t);
  }, [charger]);

  const liste = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    if (!q) return courses ?? [];
    return (courses ?? []).filter((c) =>
      [c.ref, c.customer_name, c.address, c.company, c.phone].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [courses, filtre]);

  const actif = useMemo(() => (courses ?? []).find((c) => c.id === ouvert) ?? null, [courses, ouvert]);

  /** Le trajet, depuis là où l'on est — c'est ce qui le distingue d'une carte. */
  const tracer = useCallback(async (depuis: Point | null) => {
    if (!actif) return;
    try {
      const q = depuis ? `?from=${depuis.lat},${depuis.lng}` : "";
      const r = await fetch(`/api/courier/orders/${actif.id}/itinerary${q}`, { headers: { ...authHeaders() } });
      const d = await r.json();
      setTrajet(d?.ok ? (d.points ?? []) : []);
      if (depuis) calcule.current = depuis;
    } catch {
      setTrajet([]);
    }
  }, [actif]);

  useEffect(() => { calcule.current = null; tracer(moi); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [actif?.id]);

  // ── Démarrer : le téléphone suit, la route se refait ─────────────────────
  function demarrer() {
    if (!navigator.geolocation) return toast.error("Ce téléphone ne partage pas sa position.");
    setEnRoute(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMoi(point);

        // Recalcul quand on a vraiment avancé : inutile de demander une route à
        // chaque frémissement du GPS.
        if (!calcule.current || metres(calcule.current, point) > 120) tracer(point);

        // Et le vendeur voit où en est son livreur.
        const maintenant = Date.now();
        if (maintenant - envoye.current > 15000) {
          envoye.current = maintenant;
          fetch("/api/courier/position", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ ...point, agentId: actif?.agent_id }),
          }).catch(() => {});
        }
      },
      () => { if (!moi) toast.error("Position indisponible. Active la localisation."); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    // Prendre la course : elle porte désormais son nom.
    if (actif && !actif.mine) {
      fetch(`/api/courier/orders/${actif.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: "take" }),
      }).then(() => charger()).catch(() => {});
    }
  }

  function arreter() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setEnRoute(false);
  }

  useEffect(() => () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); }, []);

  async function livrer(c: Course) {
    if (!confirm(`Confirmer la remise de la commande ${c.ref} ?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/courier/orders/${c.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: "delivered" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Impossible de marquer la livraison");
      toast.success(`Commande ${c.ref} livrée.`);
      arreter();
      setCourses((l) => (l ?? []).filter((x) => x.id !== c.id));
      setOuvert(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (connecte === false) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-[520px] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-[22px] font-bold">Espace livreur</h1>
        <p className="mt-2 text-[13.5px]" style={{ color: GRIS }}>
          Connecte-toi avec ton compte Camille pour voir tes courses.
        </p>
        <Link href="/login" className="mt-5 inline-flex h-11 items-center rounded-full bg-[#101012] px-6 text-[13.5px] font-semibold text-white">
          Se connecter
        </Link>
      </div>
    );
  }

  const bouton = "flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[9px] text-[12.5px] font-semibold";

  return (
    <Ecran
      aside={
        <>
          <EnTete
            valeur={recherche}
            onChange={setRecherche}
            onSubmit={() => setFiltre(recherche)}
            placeholder="Numéro de commande"
            bouton="Chercher"
            compteur="Courses à livrer :"
            valeurCompteur={courses?.length ?? 0}
          />

          <div className="flex items-center justify-between px-4 pb-3 text-[11.5px]" style={{ color: GRIS_PALE }}>
            <span className="truncate">
              {missions.length ? missions.map((m) => m.shop).join(" · ") : "Aucune boutique rattachée"}
            </span>
            <Link href="/dashboard" className="flex shrink-0 items-center gap-1 underline">
              <LayoutDashboard className="h-3 w-3" /> Tableau de bord
            </Link>
          </div>

          {warning && (
            <p className="mx-4 mb-3 rounded-[9px] p-3 text-[12.5px]" style={{ background: "#FDF7E7", color: "#8A5A00" }}>
              {warning}
            </p>
          )}

          {/* Le code : ce que le livreur donne au commerçant pour être ajouté. */}
          {code && (
            <div className="mx-4 mb-3 rounded-[10px] p-3" style={{ border: "1px solid #EDEDF2" }}>
              <div className="text-[10.5px]" style={{ color: GRIS_PALE }}>Ton code livreur</div>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 rounded-[8px] px-2.5 py-2 font-mono text-[15px] font-bold tracking-[0.1em]"
                  style={{ background: "#F4F4F6", color: "#101012" }}>
                  {code}
                </code>
                <button
                  onClick={() => { navigator.clipboard?.writeText(code); setCopie(true); setTimeout(() => setCopie(false), 1600); }}
                  className="flex h-[36px] items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-semibold"
                  style={{ border: "1px solid #E6E6EC", color: "#101012" }}
                >
                  {copie ? <Check className="h-[14px] w-[14px]" /> : <Copy className="h-[14px] w-[14px]" />}
                  {copie ? "Copié" : "Copier"}
                </button>
              </div>
              <p className="mt-2 text-[11.5px] leading-snug" style={{ color: GRIS }}>
                Donne-le au commerçant : il le colle dans son tableau de bord et tes courses arrivent ici.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 px-4 pb-5">
            {courses === null ? (
              <p className="text-[13px]" style={{ color: GRIS }}>Chargement…</p>
            ) : liste.length === 0 ? (
              <Rien texte="Aucune course en attente. Les commandes arrivent ici dès que le commerçant les met en livraison." />
            ) : (
              liste.map((c) => {
                const deplie = c.id === ouvert;
                return (
                  <Carte
                    key={c.id}
                    reference={c.ref}
                    deplie={deplie}
                    onToggle={() => { if (!deplie) arreter(); setOuvert(deplie ? null : c.id); }}
                  >
                    <Ligne label="À livrer à :" valeur={heure(c.scheduled_at)} />
                    <Ligne label="Nombre d'articles :" valeur={`${c.items_count}×`} />
                    <Ligne label="À encaisser :" valeur={c.payment_method ? "Déjà réglé" : `${Number(c.total).toLocaleString("fr-FR")} ${c.currency}`} />

                    <BlocLivraison
                      status={c.status}
                      vers={c.address}
                      depuis={c.shop_location || c.shop}
                      etapes={etapes(c)}
                      pied={
                        <div className="grid gap-2 px-3 py-2.5">
                          {/* Le client, joignable en un geste */}
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                              style={{ background: "rgba(124,90,248,.14)", color: VIOLET }}
                            >
                              {(c.customer_name || "C").trim().charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-bold" style={{ color: "#101012" }}>
                                {c.customer_name || "Client"}
                              </span>
                              <span className="block text-[10.5px]" style={{ color: GRIS_PALE }}>
                                {c.company || "Client"}
                              </span>
                            </span>
                            {c.phone && (
                              <>
                                <a href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer"
                                  aria-label="Écrire au client"
                                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
                                  style={{ background: "#F4F4F6", color: "#5B5766" }}>
                                  <MessageCircle className="h-[14px] w-[14px]" />
                                </a>
                                <a href={`tel:${c.phone}`} aria-label="Appeler le client"
                                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
                                  style={{ background: "#F4F4F6", color: "#5B5766" }}>
                                  <Phone className="h-[14px] w-[14px]" />
                                </a>
                              </>
                            )}
                          </div>

                          {/* Les gestes de la course */}
                          <div className="flex gap-2">
                            {enRoute && deplie ? (
                              <button onClick={arreter} className={bouton} style={{ border: "1px solid #E6E6EC", color: "#101012" }}>
                                <Square className="h-[14px] w-[14px]" /> Pause
                              </button>
                            ) : (
                              <button onClick={() => { setOuvert(c.id); demarrer(); }} className={bouton} style={{ background: VIOLET, color: "#fff" }}>
                                <Play className="h-[14px] w-[14px]" /> Démarrer
                              </button>
                            )}
                            {c.lat != null && c.lng != null && (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving`}
                                target="_blank" rel="noreferrer"
                                className={bouton} style={{ border: "1px solid #E6E6EC", color: "#101012" }}
                              >
                                <Navigation className="h-[14px] w-[14px]" /> Guidage
                              </a>
                            )}
                          </div>

                          <button
                            onClick={() => livrer(c)}
                            disabled={busy}
                            className="flex h-[40px] items-center justify-center gap-2 rounded-[9px] text-[13px] font-bold"
                            style={{ background: "#101012", color: "#C6F24E", opacity: busy ? 0.6 : 1 }}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Confirmer la livraison
                          </button>

                          {deplie && enRoute && (
                            <p className="text-[11px]" style={{ color: GRIS }}>
                              {moi
                                ? "Position suivie — la route se recalcule pendant que tu roules."
                                : "En attente du GPS…"}
                            </p>
                          )}
                        </div>
                      }
                    />

                    {c.note && (
                      <p className="mt-2.5 text-[12px]" style={{ color: GRIS }}>{c.note}</p>
                    )}
                  </Carte>
                );
              })
            )}
          </div>
        </>
      }
      carte={
        <TrackingMap
          className="h-full w-full"
          points={trajet}
          from={actif?.shop_lat != null && actif?.shop_lng != null ? { lat: actif.shop_lat, lng: actif.shop_lng } : null}
          to={actif?.lat != null && actif?.lng != null ? { lat: actif.lat, lng: actif.lng } : null}
          courier={moi}
        />
      }
    />
  );
}
