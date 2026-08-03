"use client";

/**
 * Aperçu du bon de commande.
 *
 * Reproduit la mise en page de `lib/pdf.js` (buyfacturation) avec des articles
 * fictifs, pour que le vendeur voie ce qu'il règle au lieu de l'imaginer. Les
 * modèles, les filets et l'alternance suivent exactement les mêmes règles que
 * le rendu PDF ; toute divergence ici est un bug d'aperçu, pas un choix.
 *
 * Un aperçu ne remplace pas le document : ce qui compte reste le PDF envoyé au
 * client. On ne rejoue donc que ce qui dépend des réglages.
 */

export interface BonStyle {
  name: string; tagline: string; address: string; phone: string;
  email: string; rccm: string; niu: string; logo_url: string; color: string;
  template: string; lines: string; zebra: boolean; banner_url: string;
}

const ORANGE = "#DD5509";
const GRIS = "#6B7280";
const FILET = "#E6E6E6";
const PALE = "#FBF6F2";
const NOIR = "#1F2328";
const CREME = "#FCF1E8";

/** Mêmes trois modèles que le PDF. */
export const MODELES = {
  classique: { entete: "plein",    lines: "horizontales", zebra: true,  nom: "Classique" },
  epure:     { entete: "souligne", lines: "aucune",       zebra: false, nom: "Épuré" },
  contraste: { entete: "sombre",   lines: "toutes",       zebra: false, nom: "Contrasté" },
} as const;

export type ModeleId = keyof typeof MODELES;

/** Les réglages fins l'emportent sur le modèle, comme côté PDF. */
export function resoudreStyle(d: Partial<BonStyle>) {
  const id = (Object.keys(MODELES) as ModeleId[]).includes(d.template as ModeleId)
    ? (d.template as ModeleId)
    : "classique";
  const base = MODELES[id];
  return {
    template: id,
    entete: base.entete,
    lines: ["toutes", "horizontales", "aucune"].includes(d.lines ?? "") ? d.lines! : base.lines,
    zebra: typeof d.zebra === "boolean" ? d.zebra : base.zebra,
  };
}

function accentDe(color?: string) {
  const c = (color ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : ORANGE;
}

const ARTICLES = [
  { description: "Chemise en lin — Bleu, L", quantity: 2, price: 15000 },
  { description: "Ceinture cuir tressé", quantity: 1, price: 8500 },
  { description: "Livraison", quantity: 1, price: 2000 },
];

export default function BonPreview({ d }: { d: Partial<BonStyle> }) {
  const accent = accentDe(d.color);
  const st = resoudreStyle(d);
  const total = ARTICLES.reduce((s, a) => s + a.quantity * a.price, 0);
  const fmt = (n: number) => n.toLocaleString("fr-FR") + " FCFA";

  const entete =
    st.entete === "sombre"
      ? { background: NOIR, color: "#fff" }
      : st.entete === "souligne"
        ? { borderBottom: `2px solid ${accent}`, color: accent }
        : { background: accent, color: "#fff" };

  const cellule = (derniere = false): React.CSSProperties => ({
    padding: "5px 7px",
    ...(st.lines !== "aucune" ? { borderBottom: `1px solid ${FILET}` } : {}),
    ...(st.lines === "toutes" && !derniere ? { borderRight: `1px solid ${FILET}` } : {}),
  });

  // Aucun champ n'est inventé : ce qui est vide reste vide, exactement comme
  // sur le document. C'est tout l'intérêt de l'aperçu.
  const lignesIdentite = [
    d.address, d.phone && `Tél : ${d.phone}`, d.email,
    d.rccm && `RCCM : ${d.rccm}`, d.niu && `NIU : ${d.niu}`,
  ].filter(Boolean) as string[];

  const pied = [d.name, d.address, d.phone && `Tél : ${d.phone}`, d.rccm && `RCCM : ${d.rccm}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{
        background: "#fff", color: NOIR, fontSize: 8.5, lineHeight: 1.45,
        padding: 22, fontFamily: "Arial, Helvetica, sans-serif",
        boxShadow: "0 1px 3px rgba(0,0,0,.18)", borderRadius: 4,
      }}
    >
      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12 }}>
            {d.name || <span style={{ color: GRIS, fontWeight: 400 }}>[ nom de l&apos;entreprise ]</span>}
          </div>
          {d.tagline ? <div style={{ fontStyle: "italic", fontSize: 7.5, color: GRIS }}>{d.tagline}</div> : null}
          {lignesIdentite.map((l, i) => (
            <div key={i} style={{ color: i >= 2 ? GRIS : undefined, fontSize: i >= 2 ? 7.5 : 8.5 }}>{l}</div>
          ))}
        </div>
        {d.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- média camille-core, hors domaines Next
          <img src={d.logo_url} alt="" style={{ maxWidth: 76, maxHeight: 40, objectFit: "contain" }} />
        ) : null}
      </div>

      <div style={{ borderBottom: `3px solid ${accent}`, margin: "8px 0 10px" }} />
      <div style={{ fontWeight: 700, fontSize: 17, color: accent, marginBottom: 10 }}>BON DE COMMANDE</div>

      {/* Client + méta */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 7, letterSpacing: .4, color: accent, marginBottom: 3 }}>COMMANDÉ PAR</div>
          <div style={{ fontWeight: 700 }}>Awa Ngassa</div>
          <div>Akwa, Douala</div>
          <div>+237 6 99 00 00 00</div>
        </div>
        <div style={{ flex: 1, background: CREME, padding: "7px 9px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: GRIS }}>N° de commande</span>
            <span style={{ fontWeight: 700, color: accent }}>BC-A7F2C1</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: GRIS }}>Date d&apos;émission</span>
            <span>03/08/2026</span>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div style={{ display: "flex", ...entete, fontWeight: 700, fontSize: 7.5 }}>
        <div style={{ flex: 4, padding: "5px 7px" }}>DÉSIGNATION</div>
        <div style={{ flex: 1, padding: "5px 7px", textAlign: "center" }}>QTÉ</div>
        <div style={{ flex: 2, padding: "5px 7px", textAlign: "right" }}>PRIX UNIT.</div>
        <div style={{ flex: 2, padding: "5px 7px", textAlign: "right" }}>MONTANT</div>
      </div>
      {ARTICLES.map((a, i) => (
        <div key={i} style={{ display: "flex", background: st.zebra && i % 2 === 1 ? PALE : "#fff" }}>
          <div style={{ flex: 4, ...cellule() }}>{a.description}</div>
          <div style={{ flex: 1, textAlign: "center", ...cellule() }}>{a.quantity}</div>
          <div style={{ flex: 2, textAlign: "right", ...cellule() }}>{fmt(a.price)}</div>
          <div style={{ flex: 2, textAlign: "right", ...cellule(true) }}>{fmt(a.quantity * a.price)}</div>
        </div>
      ))}

      {/* Total */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4, marginBottom: 8 }}>
        <div style={{ width: "56%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 7px" }}>
            <span>TVA</span><span style={{ color: GRIS }}>Non applicable</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", background: accent, color: "#fff", fontWeight: 700, padding: "5px 7px" }}>
            <span>TOTAL NET À PAYER</span><span>{fmt(total)}</span>
          </div>
        </div>
      </div>

      <div style={{ borderLeft: `3px solid ${accent}`, background: CREME, padding: "6px 9px", marginBottom: 8 }}>
        Commande arrêtée à la somme de <b style={{ color: accent }}>quarante mille cinq cents francs CFA</b>.
      </div>

      {/* Bandeau : large, peu haut, avant le pied de page */}
      {d.banner_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- média camille-core, hors domaines Next
        <img src={d.banner_url} alt="" style={{ width: "100%", maxHeight: 54, objectFit: "contain", marginTop: 6 }} />
      ) : null}

      <div style={{ borderTop: `1px solid ${FILET}`, marginTop: 10, paddingTop: 4, textAlign: "center", fontSize: 6.5, color: GRIS }}>
        {pied || " "}
      </div>
    </div>
  );
}
