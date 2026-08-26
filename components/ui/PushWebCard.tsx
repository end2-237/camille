"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Activation des notifications hors de l'onglet.
//
// Le navigateur n'accorde l'autorisation qu'après un geste de l'utilisateur :
// la demander au chargement fait apparaître une pastille que personne n'attend,
// et un refus est définitif — il faut alors passer par les réglages du
// navigateur. D'où ce bouton explicite.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, Share } from "lucide-react";
import { toast } from "sonner";
import {
  activerPushWeb, desactiverPushWeb, lireEtatPush, pushRefuseIci, type EtatPush,
} from "@/lib/push-web";

export function PushWebCard() {
  const [etat, setEtat] = useState<EtatPush | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let vivant = true;
    lireEtatPush().then((initial) => {
      if (!vivant) return;
      setEtat(initial);
      // Autorisation déjà accordée : on rattache le jeton sans rien demander —
      // un jeton tourne, et un navigateur autorisé mais non enregistré serait
      // silencieux sans que rien ne le signale. Sauf si ce navigateur a été
      // éteint volontairement : on ne rallume pas ce que le commerçant a
      // éteint.
      if (initial === "actif" || (initial === "a-activer" && !pushRefuseIci() && Notification.permission === "granted")) {
        activerPushWeb(false).then((suite) => vivant && setEtat(suite));
      }
    });
    return () => { vivant = false; };
  }, []);

  if (etat === null || etat === "non-configure") return null;

  async function activer() {
    setBusy(true);
    try {
      const r = await activerPushWeb(true);
      setEtat(r);
      if (r === "actif") toast.success("Notifications activées sur ce navigateur");
      else if (r === "refuse") toast.error("Autorisation refusée — à réactiver dans les réglages du navigateur");
    } finally { setBusy(false); }
  }

  async function desactiver() {
    setBusy(true);
    try {
      await desactiverPushWeb();
      setEtat("a-activer");
      toast.success("Ce navigateur ne recevra plus de notifications");
    } finally { setBusy(false); }
  }

  const { Icon, titre, texte } = {
    "actif":        { Icon: BellRing, titre: "Notifications activées",        texte: "Tu les reçois même quand le site est fermé." },
    "a-activer":    { Icon: Bell,     titre: "Recevoir les alertes hors du site", texte: "Commande reçue, agent déconnecté, rupture de stock — comme sur le téléphone." },
    "refuse":       { Icon: BellOff,  titre: "Notifications bloquées",        texte: "Le navigateur les refuse pour ce site. À réactiver dans ses réglages, à côté de la barre d'adresse." },
    "a-installer":  { Icon: Share,    titre: "Ajoutez Camille à votre écran d'accueil", texte: "Sur iPhone, les notifications arrivent une fois l'application installée : bouton Partager, puis « Sur l'écran d'accueil ». Ouvrez-la ensuite depuis l'icône et revenez ici." },
    "non-supporte": { Icon: BellOff,  titre: "Navigateur non compatible",     texte: "Les notifications hors onglet demandent un navigateur récent — sur iPhone, iOS 16.4 au minimum. Le journal ci-dessous reste à jour." },
    "non-configure":{ Icon: BellOff,  titre: "",                              texte: "" },
  }[etat];

  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-3 rounded-xl p-4"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }}
    >
      <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--text-secondary)" }} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>{titre}</div>
        <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{texte}</div>
      </div>

      {etat === "a-activer" && (
        <button onClick={activer} disabled={busy} className="btn-gold disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
          Activer
        </button>
      )}
      {etat === "actif" && (
        <button onClick={desactiver} disabled={busy} className="btn-ghost disabled:opacity-60">
          Désactiver ici
        </button>
      )}
    </div>
  );
}
