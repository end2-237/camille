// ─────────────────────────────────────────────────────────────────────────────
// Livraison et service : les règles pures (sans base), éprouvées par npm test.
// ─────────────────────────────────────────────────────────────────────────────
import { sansAccent } from "./recherche";

/** Le barème par quartier de l'agent : [{ zone, fee }]. */
export function zonesDe(agent: { delivery_zones?: unknown }): { zone: string; fee: number }[] {
  let brut: unknown = agent.delivery_zones;
  if (typeof brut === "string") { try { brut = JSON.parse(brut); } catch { brut = []; } }
  return (Array.isArray(brut) ? brut : [])
    .map((z: { zone?: string; name?: string; fee?: number; price?: number }) => ({
      zone: String(z?.zone ?? z?.name ?? "").trim(),
      fee: Number(z?.fee ?? z?.price) || 0,
    }))
    .filter((z) => z.zone);
}

/** Le quartier nommé dans une adresse écrite, s'il est au barème. Le plus long l'emporte (« Bonamoussadi » avant « Bona »). */
export function zoneDansAdresse(zones: { zone: string; fee: number }[], adresse: string) {
  const a = sansAccent(adresse);
  // Sans espaces ni tirets : « bona moussadi », « Bonamoussadi », « PK 14 » / « PK14 ».
  const serre = (s: string) => sansAccent(s).replace(/[^a-z0-9]/g, "");
  const as = serre(adresse);
  const tries = [...zones].sort((x, y) => y.zone.length - x.zone.length);
  return tries.find((z) => a.includes(sansAccent(z.zone))) || tries.find((z) => serre(z.zone).length >= 4 && as.includes(serre(z.zone))) || null;
}

/** Jours de service : 1 = lundi … 7 = dimanche ; liste vide = tous les jours. */
export function servieAujourdhui(jours: unknown, quand = new Date()): boolean {
  const liste = (Array.isArray(jours) ? jours : []).map(Number).filter((n) => n >= 0 && n <= 7);
  if (!liste.length) return true;
  const nom = quand.toLocaleDateString("en-US", { weekday: "short", timeZone: "Africa/Douala" });
  const j = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(nom) + 1;
  return liste.includes(j) || (j === 7 && liste.includes(0));
}
