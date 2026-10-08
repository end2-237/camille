// ─────────────────────────────────────────────────────────────────────────────
// Le suivi de commande sur WhatsApp (transport Meta).
//
// Une fois la commande passée, le client n'avait plus que deux nouvelles : le
// bon de commande en PDF, puis un « merci » à la livraison. Rien quand elle
// part, rien si elle est annulée, et aucun moyen de demander où elle en est
// sans écrire — donc sans attendre une réponse.
//
// Ici, chaque étape envoie un message court avec des BOUTONS. Le détail n'est
// envoyé que si le client le demande : récapitulatif, étapes, livreur. Un fil
// WhatsApp encombré de tout, tout de suite, ne se lit plus.
//
// Les boutons portent « cmd:<action>:<ref> ». La référence suffit à retrouver
// la commande, mais on vérifie TOUJOURS qu'elle appartient au numéro qui
// appuie : un identifiant de bouton se recopie.
//
// camille-core n'a pas de boutons : ses clients gardent le parcours d'avant.
// ─────────────────────────────────────────────────────────────────────────────

/** Préfixe de nos boutons de suivi, distinct de « cam: » et des identifiants de catalogue. */
export const PREFIXE_SUIVI = "cmd:";

export const ACTIONS_SUIVI = [
  "recap", "etapes", "livreur", "aide", "parfait", "souci", "encore", "boutique", "adresse",
] as const;
export type ActionSuivi = (typeof ACTIONS_SUIVI)[number];

export const idSuivi = (action: ActionSuivi, ref: string) => `${PREFIXE_SUIVI}${action}:${ref}`;

/** « cmd:recap:A1B2 » → { action: "recap", ref: "A1B2" } ; null pour tout autre identifiant. */
export function lireIdSuivi(id: string | null | undefined): { action: ActionSuivi; ref: string } | null {
  const m = String(id || "").match(/^cmd:([a-z]+):(.+)$/);
  if (!m || !(ACTIONS_SUIVI as readonly string[]).includes(m[1])) return null;
  return { action: m[1] as ActionSuivi, ref: m[2] };
}

/** Ce qu'il faut savoir d'une commande pour en parler au client. */
export type CommandeSuivie = {
  ref: string;
  status: string;
  fulfillment?: string | null;
  items?: { name?: string; variant?: string; qty?: number; price?: number }[] | null;
  subtotal?: number | null;
  delivery_fee?: number | null;
  total?: number | null;
  currency?: string | null;
  address?: string | null;
  place_label?: string | null;
  created_at?: string | Date | null;
  processing_at?: string | Date | null;
  dispatched_at?: string | Date | null;
  delivered_at?: string | Date | null;
  customer_name?: string | null;
  courier_name?: string | null;
};

const montant = (n: number, cur = "XAF") =>
  `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${cur === "XAF" ? "FCFA" : cur}`;

const heure = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return x.toLocaleString("fr-FR", {
    timeZone: "Africa/Douala", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
};

const retrait = (o: CommandeSuivie) => o.fulfillment === "retrait";

/**
 * Le message envoyé quand la commande change d'étape, ou null quand l'étape
 * ne mérite pas de message (« nouvelle » : la confirmation est déjà partie).
 */
export function annonce(
  o: CommandeSuivie,
  opts: { boutique?: string; avecLivreur?: boolean } = {}
): { texte: string; boutons: { id: string; title: string }[] } | null {
  const ref = o.ref;
  const prenom = String(o.customer_name || "").trim().split(/\s+/)[0] || "";
  const shop = opts.boutique || "Nous";
  const recap = { id: idSuivi("recap", ref), title: "🧾 Récapitulatif" };
  const aide = { id: idSuivi("aide", ref), title: "💬 Une question" };

  switch (o.status) {
    case "en_traitement":
    case "traitee":
      return {
        texte: `👨‍🍳 Ta commande *${ref}* est en préparation.\n\nTouche un bouton si tu veux le détail 👇`,
        boutons: [recap, { id: idSuivi("etapes", ref), title: "📍 Où en est-elle ?" }, aide],
      };

    case "en_livraison":
      if (retrait(o)) {
        return {
          texte: `✅ Ta commande *${ref}* est prête ! Tu peux passer la récupérer quand tu veux 🏪`,
          boutons: [{ id: idSuivi("adresse", ref), title: "📍 L'adresse" }, recap, aide],
        };
      }
      return {
        texte: `🛵 Ta commande *${ref}* est en route !\n\nGarde ton téléphone à portée de main, le livreur peut t'appeler.`,
        boutons: [
          opts.avecLivreur
            ? { id: idSuivi("livreur", ref), title: "🛵 Mon livreur" }
            : { id: idSuivi("etapes", ref), title: "📍 Où en est-elle ?" },
          recap,
          aide,
        ],
      };

    case "livree":
      return {
        texte:
          `Merci ${prenom} 🙏\n\n` +
          `Ta commande *${ref}* est ${retrait(o) ? "récupérée" : "livrée"}. ${shop} te remercie pour ta confiance.\n\n` +
          `Tout s'est bien passé ?`,
        boutons: [
          { id: idSuivi("parfait", ref), title: "😊 Tout est parfait" },
          { id: idSuivi("souci", ref), title: "⚠️ Un souci" },
          { id: idSuivi("encore", ref), title: "🛍️ Recommander" },
        ],
      };

    case "annulee":
      return {
        texte:
          `Ta commande *${ref}* a été annulée.\n\n` +
          `Si c'est une erreur, ou si tu veux autre chose, je suis là 🙂`,
        boutons: [{ id: idSuivi("boutique", ref), title: "🛍️ Voir la boutique" }, aide],
      };

    default:
      return null;
  }
}

/** Le récapitulatif demandé : articles, frais, total, réception. */
export function recapCommande(o: CommandeSuivie): string {
  const cur = o.currency || "XAF";
  const lignes = (Array.isArray(o.items) ? o.items : []).map((it) => {
    const qte = Number(it.qty) || 1;
    const nom = `${it.name || "Article"}${it.variant ? ` — ${it.variant}` : ""}`;
    return `• ${qte}× ${nom}${it.price ? ` : ${montant(qte * Number(it.price), cur)}` : ""}`;
  });
  const frais = Number(o.delivery_fee) || 0;
  const lieu = retrait(o) ? "🏪 Retrait en boutique" : o.place_label || o.address ? `📍 ${o.place_label || o.address}` : "";
  return [
    `🧾 Commande *${o.ref}*`,
    "",
    ...lignes,
    "",
    ...(frais > 0 ? [`Livraison : ${montant(frais, cur)}`] : []),
    ...(o.total != null ? [`Total : *${montant(Number(o.total), cur)}*`] : []),
    ...(lieu ? [lieu] : []),
  ].join("\n");
}

/** Les étapes franchies, avec leur heure : la réponse à « elle en est où ? ». */
export function etapesCommande(o: CommandeSuivie): string {
  if (o.status === "annulee") return `❌ La commande *${o.ref}* a été annulée.`;
  const fait = (rang: number) => {
    const r = { nouvelle: 0, en_traitement: 1, traitee: 1, en_livraison: 2, livree: 3 }[o.status] ?? 0;
    return r >= rang;
  };
  const ligne = (ok: boolean, titre: string, quand?: string | Date | null) =>
    `${ok ? "✅" : "⏳"} ${titre}${ok && heure(quand) ? ` — ${heure(quand)}` : ""}`;
  return [
    `📍 Commande *${o.ref}*`,
    "",
    ligne(true, "Commande reçue", o.created_at),
    ligne(fait(1), "En préparation", o.processing_at),
    ligne(fait(2), retrait(o) ? "Prête à récupérer" : "En route", o.dispatched_at),
    ligne(fait(3), retrait(o) ? "Récupérée" : "Livrée", o.delivered_at),
  ].join("\n");
}
