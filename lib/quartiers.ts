// ─────────────────────────────────────────────────────────────────────────────
// Les quartiers, ville par ville, pour composer le barème de livraison sans
// rien taper : le commerçant coche, donne un tarif, et c'est fait.
//
// Aucun import : le tableau de bord s'en sert, et les tests aussi. La liste
// n'est pas fermée — un quartier absent s'ajoute à la main, et le nom tapé par
// le client est rapproché du barème par `zoneDansAdresse`.
// ─────────────────────────────────────────────────────────────────────────────

export const QUARTIERS: Record<string, string[]> = {
  Douala: [
    "Akwa", "Akwa Nord", "Ange Raphaël", "Bali", "Bangue", "Bassa", "Beedi", "Bekoko", "Bépanda",
    "Bépanda Omnisports", "Bessengue", "Bilongue", "Bojongo", "Boko", "Bonabéri", "Bonadibong",
    "Bonadiwoto", "Bonadoumbé", "Bonamatoumbé", "Bonambappé", "Bonamikano", "Bonamouti", "Bonamoussadi",
    "Bonanjo", "Bonapriso", "Bonassama", "Bonateki", "Bonendalé", "Brazzaville", "Camp Yabassi",
    "Cité Berge", "Cité Cicam", "Cité des Palmiers", "Cité SIC", "Congo", "Dakar", "Deïdo", "Denver",
    "Grand Hangar", "Japoma", "Joss", "Kassalafam", "Kotto", "Koumassi", "Lendi", "Logbaba", "Logbessou",
    "Logpom", "Mabanda", "Madagascar", "Makepe", "Makepe Missoké", "Malangue", "Mbanga Bakoko",
    "Mboppi", "Ndobo", "Ndogbati", "Ndogbong", "Ndoghem", "Ndogpassi", "Ndogsimbi", "Ndokoti",
    "New Bell", "Ngangue", "Ngodi", "Ngodi Bakoko", "Ngwele", "Nkololoun", "Nkongmondo", "Nyalla",
    "Nylon", "Oyack", "Petit Pays", "PK8", "PK9", "PK10", "PK11", "PK12", "PK13", "PK14", "PK15",
    "PK16", "PK17", "PK18", "PK19", "PK20", "PK21", "Rails", "Santa Barbara", "Sébenjongo", "Sodiko",
    "Soboum", "Tergal", "Village", "Yassa", "Youpwé",
  ],
};

export const VILLES = Object.keys(QUARTIERS);

/** Une ligne du barème. */
export type Zone = { zone: string; fee: number };

/** « Akwa = 500 » par ligne → zones. Les lignes illisibles sont ignorées. */
export function lireBareme(texte: string): Zone[] {
  return String(texte || "")
    .split("\n")
    .map((l) => l.match(/^(.+?)\s*[=:]\s*(\d+)\s*$/))
    .filter((m): m is RegExpMatchArray => !!m && !!m[1].trim())
    .map((m) => ({ zone: m[1].trim(), fee: Number(m[2]) }));
}

/** L'inverse : une ligne par quartier, triées par tarif puis par nom. */
export function ecrireBareme(zones: Zone[]): string {
  return [...zones]
    .sort((a, b) => a.fee - b.fee || a.zone.localeCompare(b.zone, "fr"))
    .map((z) => `${z.zone} = ${z.fee}`)
    .join("\n");
}

/** Ajoute ou met à jour des quartiers à un tarif, sans doublon (casse et accents ignorés). */
export function appliquerTarif(zones: Zone[], noms: string[], fee: number): Zone[] {
  const cle = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const garde = zones.filter((z) => !noms.some((n) => cle(n) === cle(z.zone)));
  return [...garde, ...noms.map((zone) => ({ zone, fee }))];
}
