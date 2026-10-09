"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Le téléphone de la page d'accueil : un iPhone, et dedans WhatsApp tel que
// le client le voit vraiment avec Camille — les messages interactifs de Meta
// reproduits à l'identique (fiche produit, panier envoyé, boutons de réponse,
// document), avec de vraies photos de produits. C'est la preuve : ce qu'on
// montre ici, c'est ce que Camille envoie.
//
// La conversation se joue message par message, puis recommence. Avec
// « réduire les animations », elle s'affiche d'un coup.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Video, Phone, Plus, Camera, Mic, Reply, CheckCheck, ShoppingCart } from "lucide-react";

const RESSORT = { type: "spring", stiffness: 360, damping: 30 } as const;
const BLEU = "#027EB5";

/** L'heure et les coches, en bas à droite de chaque bulle. */
function Heure({ h, lu }: { h: string; lu?: boolean }) {
  return (
    <span className="ml-2 inline-flex translate-y-[3px] items-center gap-0.5 whitespace-nowrap text-[10px]" style={{ color: "#667781", float: "right" }}>
      {h}
      {lu && <CheckCheck className="h-3.5 w-3.5" style={{ color: "#53BDEB" }} />}
    </span>
  );
}

function Bulle({ moi, children, plein = false }: { moi?: boolean; children: React.ReactNode; plein?: boolean }) {
  return (
    <div className={`relative max-w-[82%] rounded-[12px] text-[13px] leading-[1.32] ${moi ? "ml-auto rounded-tr-[3px]" : "rounded-tl-[3px]"} ${plein ? "p-1" : "px-2.5 py-1.5"}`}
      style={{ background: moi ? "#D9FDD3" : "#FFFFFF", color: "#111B21", boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)" }}>
      {children}
    </div>
  );
}

// ── Les messages de la démonstration ───────────────────────────────────────

const MESSAGES: { cle: string; rendu: React.ReactNode }[] = [
  {
    cle: "q",
    rendu: (
      <Bulle moi>
        Bonsoir, vous avez la basket rouge en 42 ?
        <Heure h="21:04" lu />
      </Bulle>
    ),
  },
  {
    // Message produit unique de Meta : image, nom, prix, texte, bouton « Voir ».
    cle: "fiche",
    rendu: (
      <Bulle plein>
        <div className="overflow-hidden rounded-[9px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/basket-rouge.jpg" alt="Basket running rouge" className="aspect-[2/1] w-full object-cover" />
        </div>
        <div className="px-1.5 pb-0.5 pt-1.5">
          <p className="text-[13px] font-semibold">Basket running rouge</p>
          <p className="text-[12.5px]" style={{ color: "#667781" }}>45 000 FCFA</p>
          <p className="mt-1">Oui 👟 il en reste <b>2</b> en 42.<Heure h="21:04" /></p>
        </div>
        <div className="mt-1 flex items-center justify-center gap-1.5 border-t py-2 text-[13px] font-medium" style={{ borderColor: "#E9EDEF", color: BLEU }}>
          Voir
        </div>
      </Bulle>
    ),
  },
  {
    // Le panier envoyé par le client (message « order » de WhatsApp).
    cle: "panier",
    rendu: (
      <Bulle moi plein>
        <div className="flex items-center gap-2.5 rounded-[9px] p-1.5" style={{ background: "rgba(0,0,0,0.04)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/basket-rouge.jpg" alt="" className="h-[50px] w-[50px] flex-shrink-0 rounded-[7px] object-cover" />
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[13px] font-semibold"><ShoppingCart className="h-3.5 w-3.5" /> 1 article</p>
            <p className="text-[11.5px]" style={{ color: "#667781" }}>45 000 FCFA (total estimé)</p>
          </div>
        </div>
        <div className="px-1.5 pt-1 text-right"><Heure h="21:05" lu /></div>
        <div className="mt-1 border-t py-2 text-center text-[13px] font-medium" style={{ borderColor: "rgba(0,0,0,0.08)", color: BLEU }}>
          Voir le panier envoyé
        </div>
      </Bulle>
    ),
  },
  {
    // Message à boutons de réponse : les boutons s'accrochent sous la bulle.
    cle: "boutons",
    rendu: (
      <div className="max-w-[82%]">
        <Bulle>
          Total : <b>45 000 FCFA</b> <span style={{ color: "#667781" }}>+ livraison 1 000</span><br />
          Comment veux-tu le recevoir ?<Heure h="21:05" />
        </Bulle>
        {["Me faire livrer", "Je passe récupérer"].map((b) => (
          <div key={b} className="mt-[3px] flex items-center justify-center gap-1.5 rounded-[10px] bg-white py-2 text-[13px] font-medium"
            style={{ color: BLEU, boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)" }}>
            <Reply className="h-3.5 w-3.5" /> {b}
          </div>
        ))}
      </div>
    ),
  },
  {
    // Le bon de commande, en document PDF.
    cle: "pdf",
    rendu: (
      <Bulle plein>
        <div className="flex items-center gap-2.5 rounded-[9px] p-2.5" style={{ background: "#F5F6F6" }}>
          <span className="flex h-9 w-7 flex-shrink-0 items-end justify-center rounded-[3px] pb-1 text-[7.5px] font-bold text-white" style={{ background: "#E5252A" }}>PDF</span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium">Bon-de-commande-CMD-2410.pdf</p>
            <p className="text-[11px]" style={{ color: "#667781" }}>1 page · 48 ko · PDF</p>
          </div>
        </div>
        <p className="px-1.5 pb-0.5 pt-1.5">✅ Livraison choisie. Commande <b>CMD-2410</b> confirmée !<Heure h="21:06" /></p>
      </Bulle>
    ),
  },
];

/** La barre d'état de l'iPhone. */
function BarreEtat({ heure }: { heure: string }) {
  return (
    <div className="relative flex h-[46px] items-center justify-between px-7 pt-1 text-[14px] font-semibold" style={{ color: "#000" }}>
      <span className="w-12">{heure}</span>
      <span className="absolute left-1/2 top-[10px] h-[27px] w-[92px] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
      <span className="flex w-12 items-center justify-end gap-1" aria-hidden="true">
        {/* réseau */}
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
        {/* wifi */}
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 2.2c2.2 0 4.2.8 5.7 2.2l1.1-1.1A9.6 9.6 0 0 0 7.5.6 9.6 9.6 0 0 0 .7 3.3l1.1 1.1a8.1 8.1 0 0 1 5.7-2.2Zm0 3.2c1.3 0 2.5.5 3.4 1.3l1.1-1.1a6.4 6.4 0 0 0-9 0l1.1 1.1c.9-.8 2.1-1.3 3.4-1.3Zm0 3.2c-.5 0-.9.2-1.2.5L7.5 10.3l1.2-1.2c-.3-.3-.7-.5-1.2-.5Z" /></svg>
        {/* batterie */}
        <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="15" height="8" rx="1.6" /><rect x="22.5" y="4" width="1.6" height="4" rx="0.8" opacity="0.4" /></svg>
      </span>
    </div>
  );
}

export function TelephoneWhatsApp() {
  const calme = useReducedMotion();
  const [n, setN] = useState(calme ? MESSAGES.length : 0);
  const [tour, setTour] = useState(0);

  useEffect(() => {
    if (calme) { setN(MESSAGES.length); return; }
    // Un message toutes les ~1,4 s, une pause, puis la conversation recommence.
    if (n < MESSAGES.length) {
      const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 700 : 1400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { setN(0); setTour((x) => x + 1); }, 6500);
    return () => clearTimeout(t);
  }, [n, calme]);

  return (
    <IPhone label="Conversation WhatsApp : le client demande une basket, reçoit la fiche produit, envoie son panier, choisit la livraison et reçoit son bon de commande.">
          {/* Le fil, sur le papier peint de WhatsApp */}
          <div className="cl-wa-fond relative flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-2.5 pb-2">
            <div className="absolute inset-x-0 top-2 flex justify-center">
              <span className="rounded-[7px] px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.92)", color: "#54656F" }}>Aujourd&apos;hui</span>
            </div>
            <div className="space-y-[6px]">
              <AnimatePresence initial={false}>
                {MESSAGES.slice(0, n).map((m) => (
                  <motion.div key={`${tour}-${m.cle}`} layout
                    initial={calme ? false : { opacity: 0, y: 14, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={RESSORT}>
                    {m.rendu}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

    </IPhone>
  );
}

/** Le cadre de l'iPhone et l'écran de conversation WhatsApp, autour d'un fil. */
export function IPhone({ label, children, heure = "21:06", ombre = true }: {
  label: string; children: React.ReactNode; heure?: string; ombre?: boolean;
}) {
  return (
    <div className="relative mx-auto w-[318px]" role="img" aria-label={label}>
      {/* Les boutons latéraux */}
      <span className="absolute -left-[3px] top-[118px] h-[30px] w-[3px] rounded-l bg-[#2A2A2D]" aria-hidden="true" />
      <span className="absolute -left-[3px] top-[166px] h-[54px] w-[3px] rounded-l bg-[#2A2A2D]" aria-hidden="true" />
      <span className="absolute -left-[3px] top-[230px] h-[54px] w-[3px] rounded-l bg-[#2A2A2D]" aria-hidden="true" />
      <span className="absolute -right-[3px] top-[186px] h-[82px] w-[3px] rounded-r bg-[#2A2A2D]" aria-hidden="true" />

      {/* Le cadre */}
      <div className="rounded-[54px] p-[11px]"
        style={{ background: "linear-gradient(145deg,#3A3A3E 0%,#1B1B1D 40%,#2B2B2F 100%)", boxShadow: (ombre ? "0 50px 90px rgba(70,40,190,0.30), " : "") + "0 0 0 1.5px #4A4A4F inset" }}>
        <div className="flex h-[680px] flex-col overflow-hidden rounded-[44px] bg-white" aria-hidden="true">
          <BarreEtat heure={heure} />

          {/* L'en-tête de conversation (WhatsApp iOS) */}
          <div className="flex items-center gap-2 border-b px-2.5 pb-2" style={{ background: "#F6F6F6", borderColor: "#E3E3E3" }}>
            <ChevronLeft className="h-6 w-6 flex-shrink-0" style={{ color: "#007AFF" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/baskets-couleurs.jpg" alt="" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[14.5px] font-semibold" style={{ color: "#000" }}>Akwa Store</p>
              <p className="truncate text-[11.5px]" style={{ color: "#8A8A8E" }}>Compte professionnel</p>
            </div>
            <Video className="h-[22px] w-[22px] flex-shrink-0" style={{ color: "#007AFF" }} />
            <Phone className="ml-3 mr-1 h-[19px] w-[19px] flex-shrink-0" style={{ color: "#007AFF" }} />
          </div>

          {children}

          {/* La barre de saisie */}
          <div className="flex items-center gap-2.5 px-3 pb-6 pt-2" style={{ background: "#F6F6F6" }}>
            <Plus className="h-6 w-6 flex-shrink-0" style={{ color: "#007AFF" }} />
            <div className="h-[32px] flex-1 rounded-full border bg-white" style={{ borderColor: "#DDDDE1" }} />
            <Camera className="h-[22px] w-[22px] flex-shrink-0" style={{ color: "#007AFF" }} />
            <Mic className="h-[22px] w-[22px] flex-shrink-0" style={{ color: "#007AFF" }} />
          </div>
        </div>
      </div>
      {/* La barre d'accueil de l'iPhone */}
      <span className="absolute bottom-[19px] left-1/2 h-[5px] w-[120px] -translate-x-1/2 rounded-full bg-black/80" aria-hidden="true" />
    </div>
  );
}

// ── Le carrousel de produits (deuxième téléphone, incliné) ─────────────────

const CARROUSEL = [
  { img: "/landing/basket-rouge.jpg",     nom: "Basket running rouge", prix: "45 000 FCFA" },
  { img: "/landing/casque.jpg",           nom: "Casque sans fil",      prix: "32 500 FCFA" },
  { img: "/landing/montre.jpg",           nom: "Montre connectée",     prix: "27 000 FCFA" },
  { img: "/landing/baskets-couleurs.jpg", nom: "Baskets Colorblock",   prix: "39 000 FCFA" },
];

/**
 * Le carrousel de produits de Meta : une bulle de texte, puis des cartes qui
 * défilent à l'horizontale — photo, nom, prix, bouton « Voir ». Les cartes
 * glissent toutes seules, comme quand le client les fait défiler du doigt.
 */
export function TelephoneCarrousel() {
  const calme = useReducedMotion();
  const LARGEUR = 214; // carte + écart
  return (
    <IPhone heure="18:42" ombre={false} label="Conversation WhatsApp : la vendeuse envoie un carrousel de produits avec photo, prix et bouton Voir.">
      <div className="cl-wa-fond relative flex min-h-0 flex-1 flex-col justify-end overflow-hidden pb-3">
        <div className="absolute inset-x-0 top-2 flex justify-center">
          <span className="rounded-[7px] px-2.5 py-1 text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.92)", color: "#54656F" }}>Aujourd&apos;hui</span>
        </div>
        <div className="space-y-[6px] px-2.5">
          <Bulle moi>Vous avez quoi comme nouveautés ?<Heure h="18:41" lu /></Bulle>
          <Bulle>Voici nos nouveautés de la semaine 👇 Touche « Voir » pour les détails et ajoute au panier.<Heure h="18:42" /></Bulle>
        </div>
        <div className="mt-[6px] overflow-hidden pl-2.5">
          <motion.div className="flex gap-2"
            animate={calme ? undefined : { x: [0, 0, -LARGEUR, -LARGEUR, -2 * LARGEUR, -2 * LARGEUR, 0] }}
            transition={calme ? undefined : { duration: 12, times: [0, 0.18, 0.28, 0.5, 0.6, 0.86, 1], ease: "easeInOut", repeat: Infinity }}>
            {CARROUSEL.map((p) => (
              <div key={p.nom} className="w-[206px] flex-shrink-0 overflow-hidden rounded-[12px] bg-white" style={{ boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.img} alt={p.nom} className="aspect-square w-full object-cover" />
                <div className="px-2.5 pb-2 pt-2">
                  <p className="truncate text-[13px] font-semibold" style={{ color: "#111B21" }}>{p.nom}</p>
                  <p className="text-[12.5px]" style={{ color: "#667781" }}>{p.prix}</p>
                </div>
                <div className="border-t py-2 text-center text-[13px] font-medium" style={{ borderColor: "#E9EDEF", color: BLEU }}>Voir</div>
              </div>
            ))}
          </motion.div>
        </div>
        <p className="mt-1 pr-3 text-right text-[10px]" style={{ color: "#667781" }}>18:42</p>
      </div>
    </IPhone>
  );
}
