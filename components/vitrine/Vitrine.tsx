"use client";
/* eslint-disable @next/next/no-img-element -- images du catalogue, servies telles quelles */

// ─────────────────────────────────────────────────────────────────────────────
// La vitrine en ligne : catalogue, panier, commande — pensée pour un téléphone
// en 3G. Le panier vit dans le navigateur (par boutique) ; la commande part à
// Camille, qui recalcule tout et confirme au client sur WhatsApp.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import type { ProduitVitrine, Vitrine } from "@/lib/vitrine";

type Ligne = { cle: string; id: string; qty: number; choix: number[]; prix: number; libelle: string };

const fcfa = (n: number, devise = "XAF") => `${Math.round(n).toLocaleString("fr-FR")} ${devise === "XAF" ? "FCFA" : devise}`;

function prixAffiche(p: ProduitVitrine) {
  if (p.prix == null) return "Prix sur demande";
  return p.prixMax && p.prixMax > p.prix ? `${fcfa(p.prix, p.devise)} – ${fcfa(p.prixMax, p.devise)}` : fcfa(p.prix, p.devise);
}

/** Prix unitaire et libellé d'une ligne selon les choix (le serveur refait le calcul). */
function calculer(p: ProduitVitrine, choix: number[]) {
  let prix = p.prix || 0;
  const libelles: string[] = [];
  p.options.forEach((g, i) => {
    const c = g.choices[choix[i]];
    if (c) { prix += c.price; libelles.push(c.label); }
    else if (!g.required && choix[i] === -1) libelles.push(`Sans ${g.name.toLowerCase()}`);
  });
  return { prix, libelle: libelles.join(", ") };
}

export function VitrineClient({ v }: { v: Vitrine }) {
  const cleStockage = `vitrine:${v.slug}`;
  const [panier, setPanier] = useState<Ligne[]>([]);
  const [categorie, setCategorie] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [fiche, setFiche] = useState<ProduitVitrine | null>(null);
  const [caisse, setCaisse] = useState(false);
  const [confirmation, setConfirmation] = useState<{ ref: string; total: number; whatsapp: boolean } | null>(null);

  // Le panier survit à un rechargement de page, pas d'une boutique à l'autre.
  useEffect(() => {
    try {
      const brut = localStorage.getItem(cleStockage);
      if (brut) {
        const lignes = JSON.parse(brut) as Ligne[];
        setPanier(lignes.filter((l) => v.produits.some((p) => p.id === l.id && !p.epuise)));
      }
    } catch { /* stockage indisponible : panier vide */ }
  }, [cleStockage, v.produits]);
  useEffect(() => {
    try { localStorage.setItem(cleStockage, JSON.stringify(panier)); } catch { /* sans importance */ }
  }, [cleStockage, panier]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return v.produits.filter((p) =>
      (!categorie || p.categorie === categorie) &&
      (!q || p.nom.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    );
  }, [v.produits, categorie, recherche]);

  const nbArticles = panier.reduce((n, l) => n + l.qty, 0);
  const sousTotal = panier.reduce((s, l) => s + l.prix * l.qty, 0);
  const devise = v.produits[0]?.devise || "XAF";

  function ajouter(p: ProduitVitrine, choix: number[], qty: number) {
    const { prix, libelle } = calculer(p, choix);
    const cle = `${p.id}|${choix.join(",")}`;
    setPanier((avant) => {
      const existe = avant.find((l) => l.cle === cle);
      if (existe) return avant.map((l) => (l.cle === cle ? { ...l, qty: Math.min(99, l.qty + qty) } : l));
      return [...avant, { cle, id: p.id, qty, choix, prix, libelle }];
    });
  }

  const lienWhatsApp = (texte: string) => (v.whatsapp ? `https://wa.me/${v.whatsapp}?text=${encodeURIComponent(texte)}` : null);

  return (
    // data-vitrine efface l'habillage du site Camille (globals.css) : la
    // vitrine est au nom du commerçant, pas au nôtre.
    <div data-vitrine className="min-h-screen bg-[#FAFAF8] text-[#19171B]" style={{ ["--accent" as string]: v.couleur }}>
      {/* En-tête */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {v.logo ? (
            <img src={v.logo} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full text-[16px] font-bold text-white" style={{ background: v.couleur }}>
              {v.nom.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold leading-tight">{v.nom}</p>
            {v.ouvert !== null && (
              <p className="flex items-center gap-1.5 text-[12px] text-black/55">
                <span className={`h-2 w-2 rounded-full ${v.ouvert ? "bg-emerald-500" : "bg-amber-500"}`} />
                {v.ouvert ? "Ouvert maintenant" : `Fermé${v.reouverture ? ` · rouvre ${v.reouverture}` : ""}`}
              </p>
            )}
          </div>
          {lienWhatsApp("Bonjour 👋") && (
            <a
              href={lienWhatsApp("Bonjour 👋")!}
              target="_blank"
              rel="noopener"
              className="flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-[13px] font-semibold text-white"
            >
              <IconeWhatsApp /> <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-32">
        {/* Présentation */}
        <section className="py-6">
          <h1 className="text-[26px] font-bold leading-tight sm:text-[32px]">{v.accroche || v.nom}</h1>
          {v.description && <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-black/65">{v.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
            {v.livraison.active && (
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5">
                🛵 Livraison{v.livraison.zones.length ? " par quartier" : v.livraison.frais ? ` · ${fcfa(v.livraison.frais, devise)}` : ""}{v.livraison.delai ? ` · ${v.livraison.delai}` : ""}
              </span>
            )}
            <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5">🏪 Retrait sur place</span>
            {v.adresse && <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5">📍 {v.adresse}</span>}
            {v.horaires && <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5">🕒 {v.horaires}</span>}
          </div>
        </section>

        {/* Recherche et rayons */}
        <div className="sticky top-[65px] z-20 -mx-4 bg-[#FAFAF8]/95 px-4 pb-3 pt-1 backdrop-blur">
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={v.resto ? "Chercher un plat…" : "Chercher un article…"}
            className="h-11 w-full rounded-full border border-black/10 bg-white px-4 text-[14px] outline-none focus:border-[var(--accent)]"
          />
          {v.categories.length > 1 && (
            <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
              {[null, ...v.categories].map((c) => (
                <button
                  key={c ?? "tout"}
                  onClick={() => setCategorie(c)}
                  className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium ring-1 ring-black/10"
                  style={categorie === c ? { background: v.couleur, color: "#fff", boxShadow: "none" } : { background: "#fff" }}
                >
                  {c ?? "Tout"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Catalogue */}
        {visibles.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibles.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setFiche(p)}
                  className="group flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
                >
                  <div className="relative aspect-square w-full bg-black/[0.03]">
                    {p.image ? (
                      <img src={p.image} alt={p.nom} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center text-[32px]">{v.resto ? "🍽️" : "🛍️"}</span>
                    )}
                    {p.duJour && <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold">Du jour</span>}
                    {p.epuise && <span className="absolute inset-0 grid place-items-center bg-white/70 text-[13px] font-semibold">Épuisé</span>}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="line-clamp-2 text-[14px] font-medium leading-snug">{p.nom}</p>
                    <p className="mt-auto pt-2 text-[14px] font-bold" style={{ color: v.couleur }}>{prixAffiche(p)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-16 text-center text-[14px] text-black/50">Rien ne correspond. Essayez un autre mot.</p>
        )}

        <footer className="mt-12 text-center text-[12px] text-black/40">
          Boutique propulsée par <span className="font-semibold">Camille</span> · commandes confirmées sur WhatsApp
        </footer>
      </main>

      {/* La barre du panier */}
      {nbArticles > 0 && !caisse && !fiche && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3">
          <button
            onClick={() => setCaisse(true)}
            className="mx-auto flex h-14 w-full max-w-lg items-center justify-between rounded-full px-6 text-[15px] font-semibold text-white shadow-lg"
            style={{ background: v.couleur }}
          >
            <span>🛒 {nbArticles} article{nbArticles > 1 ? "s" : ""}</span>
            <span>Commander · {fcfa(sousTotal, devise)}</span>
          </button>
        </div>
      )}

      {fiche && (
        <FicheProduit
          p={fiche}
          v={v}
          fermer={() => setFiche(null)}
          ajouter={(choix, qty) => { ajouter(fiche, choix, qty); setFiche(null); }}
          lienWhatsApp={lienWhatsApp(`Bonjour, je voudrais des informations sur : ${fiche.nom}`)}
        />
      )}

      {caisse && (
        <Caisse
          v={v}
          panier={panier}
          setPanier={setPanier}
          fermer={() => setCaisse(false)}
          confirmer={(c) => { setConfirmation(c); setPanier([]); setCaisse(false); }}
        />
      )}

      {confirmation && (
        <Feuille fermer={() => setConfirmation(null)}>
          <div className="py-4 text-center">
            <p className="text-[44px]">🎉</p>
            <p className="mt-2 text-[20px] font-bold">Commande envoyée !</p>
            <p className="mt-1 text-[14px] text-black/60">Référence <span className="font-semibold text-black">{confirmation.ref}</span> · {fcfa(confirmation.total, devise)}</p>
            <p className="mx-auto mt-4 max-w-sm text-[14px] leading-relaxed text-black/70">
              {confirmation.whatsapp
                ? "Vous venez de recevoir la confirmation sur WhatsApp. On vous y tient au courant de la suite."
                : `${v.nom} a bien reçu votre commande et vous contacte très vite.`}
            </p>
            <button onClick={() => setConfirmation(null)} className="mt-6 h-12 w-full rounded-full text-[15px] font-semibold text-white" style={{ background: v.couleur }}>
              Continuer mes achats
            </button>
          </div>
        </Feuille>
      )}
    </div>
  );
}

/** Une feuille qui monte du bas (téléphone) ou s'ouvre au centre (ordinateur). */
function Feuille({ children, fermer }: { children: React.ReactNode; fermer: () => void }) {
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = avant; window.removeEventListener("keydown", esc); };
  }, [fermer]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={fermer}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

function FicheProduit({
  p, v, fermer, ajouter, lienWhatsApp,
}: {
  p: ProduitVitrine; v: Vitrine; fermer: () => void; ajouter: (choix: number[], qty: number) => void; lienWhatsApp: string | null;
}) {
  const [choix, setChoix] = useState<number[]>(p.options.map((g) => (g.required ? 0 : -1)));
  const [qty, setQty] = useState(1);
  const [image, setImage] = useState(0);
  const photos = [p.image, ...p.images].filter((x, i, t): x is string => Boolean(x) && t.indexOf(x) === i);
  const { prix } = calculer(p, choix);

  return (
    <Feuille fermer={fermer}>
      <div className="-mx-5 -mt-5 mb-4 aspect-[4/3] bg-black/[0.03] sm:rounded-t-3xl">
        {photos.length ? <img src={photos[image]} alt={p.nom} className="h-full w-full object-cover sm:rounded-t-3xl" /> : null}
      </div>
      {photos.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {photos.map((src, i) => (
            <button key={src} onClick={() => setImage(i)} className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-2 ${i === image ? "ring-[var(--accent)]" : "ring-transparent"}`}>
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <h2 className="text-[20px] font-bold leading-tight">{p.nom}</h2>
      <p className="mt-1 text-[16px] font-bold" style={{ color: v.couleur }}>{prixAffiche(p)}</p>
      {p.description && <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-black/65">{p.description}</p>}

      {p.options.map((g, gi) => (
        <fieldset key={g.name} className="mt-5">
          <legend className="mb-2 text-[13px] font-semibold">
            {g.name} {g.required ? <span className="font-normal text-black/45">· obligatoire</span> : <span className="font-normal text-black/45">· facultatif</span>}
          </legend>
          <div className="grid gap-2">
            {!g.required && (
              <Choix actif={choix[gi] === -1} onClick={() => setChoix(choix.map((c, i) => (i === gi ? -1 : c)))} libelle={`Sans ${g.name.toLowerCase()}`} />
            )}
            {g.choices.map((c, ci) => (
              <Choix
                key={c.label}
                actif={choix[gi] === ci}
                onClick={() => setChoix(choix.map((x, i) => (i === gi ? ci : x)))}
                libelle={c.label}
                prix={c.price ? `+ ${fcfa(c.price, p.devise)}` : ""}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {p.epuise ? (
        <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-center text-[14px] font-medium text-amber-800">Épuisé pour le moment</p>
      ) : p.prix == null ? (
        lienWhatsApp && (
          <a href={lienWhatsApp} target="_blank" rel="noopener" className="mt-6 flex h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 text-[15px] font-semibold text-white">
            <IconeWhatsApp /> Demander le prix
          </a>
        )
      ) : (
        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-12 items-center rounded-full ring-1 ring-black/10">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-12 w-12 text-[20px]" aria-label="Moins">−</button>
            <span className="w-8 text-center text-[16px] font-semibold tabular-nums">{qty}</span>
            <button onClick={() => setQty(Math.min(99, qty + 1))} className="h-12 w-12 text-[20px]" aria-label="Plus">+</button>
          </div>
          <button onClick={() => ajouter(choix, qty)} className="h-12 flex-1 rounded-full text-[15px] font-semibold text-white" style={{ background: v.couleur }}>
            Ajouter · {fcfa(prix * qty, p.devise)}
          </button>
        </div>
      )}
      {lienWhatsApp && p.prix != null && (
        <a href={lienWhatsApp} target="_blank" rel="noopener" className="mt-3 flex items-center justify-center gap-2 py-2 text-[13px] font-medium text-[#128C7E]">
          <IconeWhatsApp /> Une question sur cet article ?
        </a>
      )}
    </Feuille>
  );
}

function Choix({ actif, onClick, libelle, prix }: { actif: boolean; onClick: () => void; libelle: string; prix?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded-2xl px-4 py-3 text-left text-[14px] ring-1 ring-black/10"
      style={actif ? { boxShadow: "inset 0 0 0 2px var(--accent)", background: "#fff" } : { background: "#fff" }}
    >
      <span className="flex items-center gap-3">
        <span className="grid h-5 w-5 place-items-center rounded-full ring-1 ring-black/20">
          {actif && <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent)" }} />}
        </span>
        {libelle}
      </span>
      {prix && <span className="text-[13px] text-black/55">{prix}</span>}
    </button>
  );
}

function Caisse({
  v, panier, setPanier, fermer, confirmer,
}: {
  v: Vitrine; panier: Ligne[]; setPanier: (f: (l: Ligne[]) => Ligne[]) => void; fermer: () => void;
  confirmer: (c: { ref: string; total: number; whatsapp: boolean }) => void;
}) {
  const devise = v.produits[0]?.devise || "XAF";
  const [mode, setMode] = useState<"livraison" | "retrait">(v.livraison.active ? "livraison" : "retrait");
  const [zone, setZone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  // Le client revient : on lui épargne de retaper son nom et son numéro.
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("vitrine:client") || "{}");
      if (c.nom) setNom(c.nom);
      if (c.telephone) setTelephone(c.telephone);
    } catch { /* rien */ }
  }, []);

  const parId = new Map(v.produits.map((p) => [p.id, p]));
  const sousTotal = panier.reduce((s, l) => s + l.prix * l.qty, 0);
  const zoneChoisie = v.livraison.zones.find((z) => z.zone === zone);
  const frais = mode === "livraison" ? (zoneChoisie ? zoneChoisie.fee : v.livraison.zones.length && zone !== "autre" ? null : v.livraison.frais) : 0;
  const total = sousTotal + (frais || 0);
  const sousMinimum = v.minimum > 0 && sousTotal < v.minimum;

  async function commander() {
    setErreur("");
    setEnvoi(true);
    try {
      const r = await fetch(`/api/vitrine/${v.slug}/commande`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lignes: panier.map((l) => ({ id: l.id, qty: l.qty, choix: l.choix })), nom, telephone, mode, zone, adresse, note }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Commande refusée");
      try { localStorage.setItem("vitrine:client", JSON.stringify({ nom, telephone })); } catch { /* rien */ }
      confirmer({ ref: d.ref, total: d.total, whatsapp: d.whatsapp });
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Feuille fermer={fermer}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[20px] font-bold">Votre commande</h2>
        <button onClick={fermer} className="h-9 w-9 rounded-full bg-black/5 text-[18px]" aria-label="Fermer">×</button>
      </div>

      <ul className="divide-y divide-black/5">
        {panier.map((l) => {
          const p = parId.get(l.id);
          return (
            <li key={l.cle} className="flex items-center gap-3 py-3">
              {p?.image ? <img src={p.image} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="h-12 w-12 rounded-xl bg-black/5" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{p?.nom}</p>
                {l.libelle && <p className="truncate text-[12px] text-black/50">{l.libelle}</p>}
                <p className="text-[13px] font-semibold">{fcfa(l.prix * l.qty, devise)}</p>
              </div>
              <div className="flex items-center rounded-full ring-1 ring-black/10">
                <button className="h-9 w-9" aria-label="Moins" onClick={() => setPanier((a) => a.flatMap((x) => (x.cle !== l.cle ? [x] : x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : [])))}>−</button>
                <span className="w-6 text-center text-[14px] tabular-nums">{l.qty}</span>
                <button className="h-9 w-9" aria-label="Plus" onClick={() => setPanier((a) => a.map((x) => (x.cle === l.cle ? { ...x, qty: Math.min(99, x.qty + 1) } : x)))}>+</button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {(["livraison", "retrait"] as const).map((m) => (
          <button
            key={m}
            disabled={m === "livraison" && !v.livraison.active}
            onClick={() => setMode(m)}
            className="rounded-2xl px-3 py-3 text-[14px] font-medium ring-1 ring-black/10 disabled:opacity-40"
            style={mode === m ? { boxShadow: "inset 0 0 0 2px var(--accent)" } : undefined}
          >
            {m === "livraison" ? "🛵 Livraison" : "🏪 Je viens chercher"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {mode === "livraison" && v.livraison.zones.length > 0 && (
          <select value={zone} onChange={(e) => setZone(e.target.value)} className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-[14px]">
            <option value="">Votre quartier…</option>
            {v.livraison.zones.map((z) => <option key={z.zone} value={z.zone}>{z.zone} · {fcfa(z.fee, devise)}</option>)}
            <option value="autre">Autre quartier</option>
          </select>
        )}
        {mode === "livraison" && (
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Adresse précise, repère (ex. face pharmacie…)" className="h-12 rounded-2xl border border-black/10 px-4 text-[14px]" />
        )}
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Votre nom" autoComplete="name" className="h-12 rounded-2xl border border-black/10 px-4 text-[14px]" />
        <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Numéro WhatsApp · 6XXXXXXXX" inputMode="tel" autoComplete="tel" className="h-12 rounded-2xl border border-black/10 px-4 text-[14px]" />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Une précision ? (facultatif)" rows={2} className="rounded-2xl border border-black/10 px-4 py-3 text-[14px]" />
      </div>

      <dl className="mt-5 space-y-1.5 text-[14px]">
        <div className="flex justify-between"><dt className="text-black/60">Sous-total</dt><dd>{fcfa(sousTotal, devise)}</dd></div>
        {mode === "livraison" && (
          <div className="flex justify-between">
            <dt className="text-black/60">Livraison</dt>
            <dd>{frais == null ? "selon le quartier" : frais ? fcfa(frais, devise) : "offerte"}</dd>
          </div>
        )}
        <div className="flex justify-between pt-1 text-[16px] font-bold"><dt>Total</dt><dd>{fcfa(total, devise)}</dd></div>
      </dl>
      <p className="mt-2 text-[12px] text-black/50">Paiement à la livraison ou au retrait. La confirmation arrive sur votre WhatsApp.</p>

      {sousMinimum && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-800">Commande minimum : {fcfa(v.minimum, devise)}.</p>}
      {erreur && <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-[13px] text-red-700">{erreur}</p>}

      <button
        onClick={commander}
        disabled={envoi || !panier.length || sousMinimum || !nom.trim() || telephone.replace(/\D/g, "").length < 9 || (mode === "livraison" && (frais == null || !adresse.trim()))}
        className="mt-5 h-14 w-full rounded-full text-[16px] font-semibold text-white disabled:opacity-40"
        style={{ background: v.couleur }}
      >
        {envoi ? "Envoi…" : `Commander · ${fcfa(total, devise)}`}
      </button>
    </Feuille>
  );
}

function IconeWhatsApp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" />
    </svg>
  );
}
