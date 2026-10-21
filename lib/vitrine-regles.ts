// ─────────────────────────────────────────────────────────────────────────────
// La vitrine en ligne : les règles pures (sans base), éprouvées par npm test.
// ─────────────────────────────────────────────────────────────────────────────
import type { GroupeOptions } from "./whatsapp/restaurant";

/** « Yoos Food Bonamoussadi » → « yoos-food-bonamoussadi ». */
export function slugDe(nom: string): string {
  return String(nom || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "boutique";
}

/** Une adresse de vitrine acceptable : 3 à 40 caractères, minuscules, chiffres, tirets. */
export const slugValide = (s: string) => /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(s);

/**
 * Le prix unitaire d'une ligne et son libellé d'options, à partir des choix
 * du client : un index par groupe, -1 = « Sans » (groupe facultatif). Un
 * groupe obligatoire sans choix valide → erreur : la cuisine doit savoir.
 */
export function prixAvecOptions(
  base: number, groupes: GroupeOptions[], choix: number[] | undefined
): { ok: true; prix: number; libelle: string } | { ok: false; groupe: string } {
  let prix = Number(base) || 0;
  const libelles: string[] = [];
  groupes.forEach((g, i) => {
    const c = Number(choix?.[i] ?? -1);
    const ch = g.choices[c];
    if (ch) {
      prix += Number(ch.price) || 0;
      libelles.push(ch.label);
    } else if (!g.required) {
      if (choix && choix[i] === -1) libelles.push(`Sans ${g.name.toLowerCase()}`);
    }
  });
  const manque = groupes.find((g, i) => g.required && !g.choices[Number(choix?.[i] ?? -1)]);
  if (manque) return { ok: false, groupe: manque.name };
  return { ok: true, prix, libelle: libelles.join(", ") };
}

/** Numéro camerounais du client → 2376XXXXXXXX, ou null. */
export function numeroClient(saisie: string): string | null {
  const d = String(saisie || "").replace(/\D/g, "").replace(/^00/, "");
  const local = d.startsWith("237") ? d.slice(3) : d;
  return /^6\d{8}$/.test(local) ? `237${local}` : null;
}
