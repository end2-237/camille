// ─────────────────────────────────────────────────────────────────────────────
// Import d'un catalogue depuis Excel (enregistré en CSV).
//
// Le commerçant déjà équipé a sa liste dans un tableur. La ressaisir article
// par article, c'est la double saisie qui le décourage. Module pur : lu tel
// quel par npm test.
//
// Excel en français écrit des « ; » et des virgules décimales ; Google Sheets
// des « , ». Les deux passent. Les colonnes sont reconnues par leur titre.
// ─────────────────────────────────────────────────────────────────────────────

export type LigneImport = {
  name: string;
  price: number | null;
  stock: number | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
};

/** Découpe un CSV (guillemets, retours à la ligne dans une cellule, « ; » ou « , »). */
export function lireCsv(texte: string): string[][] {
  const t = texte.replace(/^﻿/, "");
  const premiere = t.split(/\r?\n/, 1)[0] || "";
  const sep = (premiere.match(/;/g) || []).length >= (premiere.match(/,/g) || []).length ? ";" : ",";
  const lignes: string[][] = [];
  let cell = "", ligne: string[] = [], guil = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guil) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') guil = false;
      else cell += c;
    } else if (c === '"') guil = true;
    else if (c === sep) { ligne.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      ligne.push(cell); cell = "";
      if (ligne.some((x) => x.trim())) lignes.push(ligne);
      ligne = [];
    } else cell += c;
  }
  ligne.push(cell);
  if (ligne.some((x) => x.trim())) lignes.push(ligne);
  return lignes;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

const COLONNES: Record<keyof LigneImport, string[]> = {
  name: ["nom", "name", "produit", "product", "item", "article", "designation", "libelle", "titre"],
  price: ["prix", "price", "prixunitaire", "prixdevente", "pu", "tarif", "montant"],
  stock: ["stock", "quantite", "qte", "qty", "quantity", "enstock"],
  category: ["categorie", "category", "rayon", "famille", "type"],
  description: ["description", "details", "detail"],
  image_url: ["image", "photo", "imageurl", "lienimage", "url"],
};

/** « 12 500 », « 12.500 », « 12500,00 FCFA » → 12500. */
export function lireNombre(v: string): number | null {
  let s = String(v || "").replace(/[^\d,.-]/g, "");
  if (!s) return null;
  // Un séparateur suivi de 3 chiffres exactement en fin : séparateur de milliers.
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else s = s.replace(/\.(?=.*[.,])/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Les articles d'un CSV, et les lignes écartées avec leur raison. */
export function lireCatalogue(texte: string): { lignes: LigneImport[]; ecartees: string[]; colonnes: string[] } {
  const rangs = lireCsv(texte);
  if (rangs.length < 2) return { lignes: [], ecartees: ["Le fichier ne contient pas de ligne d'articles."], colonnes: [] };
  const tete = rangs[0].map(norm);
  const index = {} as Record<keyof LigneImport, number>;
  (Object.keys(COLONNES) as (keyof LigneImport)[]).forEach((k) => {
    index[k] = tete.findIndex((h) => COLONNES[k].includes(h));
  });
  if (index.name < 0) {
    return { lignes: [], ecartees: ["Colonne du nom introuvable : intitulez-la « Nom » ou « Produit »."], colonnes: rangs[0] };
  }
  const lignes: LigneImport[] = [];
  const ecartees: string[] = [];
  const vu = new Set<string>();
  rangs.slice(1).forEach((r, i) => {
    const val = (k: keyof LigneImport) => (index[k] >= 0 ? String(r[index[k]] ?? "").trim() : "");
    const name = val("name");
    if (!name) { ecartees.push(`Ligne ${i + 2} : sans nom`); return; }
    const cle = name.toLowerCase();
    if (vu.has(cle)) { ecartees.push(`Ligne ${i + 2} : « ${name} » en double`); return; }
    vu.add(cle);
    const stock = lireNombre(val("stock"));
    const image = val("image_url");
    lignes.push({
      name: name.slice(0, 200),
      price: lireNombre(val("price")),
      stock: stock == null ? null : Math.max(0, Math.floor(stock)),
      category: val("category") || null,
      description: val("description") || null,
      image_url: /^https?:\/\//.test(image) ? image : null,
    });
  });
  return { lignes, ecartees, colonnes: rangs[0] };
}
