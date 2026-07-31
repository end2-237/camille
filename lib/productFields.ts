// ─────────────────────────────────────────────────────────────────────────────
// Normalisation des champs produit avant écriture.
//
// Le formulaire mobile envoie `null` pour tout champ laissé vide — c'est le
// comportement naturel d'un formulaire. Mais `description`, `currency`,
// `min_order`, `active` et `sort_order` sont NOT NULL en base : modifier le
// stock d'un produit sans description faisait donc échouer la requête, et la
// route répondait 500 sans dire pourquoi.
//
// On traduit ici « vide » en la valeur par défaut de la colonne, une fois pour
// toutes, plutôt que de demander au client de connaître le schéma.
// ─────────────────────────────────────────────────────────────────────────────

/** Colonnes NOT NULL et la valeur qui tient lieu de « vide » pour chacune. */
const NOT_NULL: Record<string, unknown> = {
  description: "",
  currency: "XAF",
  min_order: 1,
  active: true,
  sort_order: 0,
};

const JSON_FIELDS = new Set(["tags", "variants", "images"]);

/** La valeur à passer à Postgres pour ce champ. */
export function coerce(key: string, value: unknown): unknown {
  if (JSON_FIELDS.has(key)) return JSON.stringify(Array.isArray(value) ? value : []);
  if (value === null || value === undefined || value === "") {
    if (key in NOT_NULL) return NOT_NULL[key];
    return null;
  }
  return value;
}
