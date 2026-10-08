// ─────────────────────────────────────────────────────────────────────────────
// Au nom de quel commerçant parle-t-on à Meta ?
//
// Avant l'Embedded Signup, Camille n'avait qu'UN numéro, UN jeton, UN catalogue,
// lus dans l'environnement. Avec plusieurs commerçants, chaque appel à Meta doit
// porter ceux de l'agent concerné — et un appel parti avec le mauvais jeton,
// c'est un client qui reçoit le message d'un autre commerce.
//
// Plutôt que de passer les identifiants à travers trente fonctions (et d'en
// oublier une), on les pose dans le CONTEXTE d'exécution au point d'entrée —
// le webhook, un envoi, une synchronisation — et meta.ts les y lit. Hors de
// tout contexte, on retombe sur l'environnement : exactement le comportement
// d'avant, donc aucun agent existant ne change de chemin.
// ─────────────────────────────────────────────────────────────────────────────
import { AsyncLocalStorage } from "node:async_hooks";

export type IdentifiantsMeta = {
  token: string;
  phoneId: string;
  catalogId: string;
  wabaId: string;
  /** « agent » : connecté par l'Embedded Signup ; « env » : identifiants de l'application. */
  source: "agent" | "env";
};

const stockage = new AsyncLocalStorage<IdentifiantsMeta>();

export function identifiantsEnv(): IdentifiantsMeta {
  return {
    token: process.env.WHATSAPP_TOKEN || "",
    phoneId: process.env.PHONE_NUMBER_ID || "",
    catalogId: process.env.CATALOG_ID || "",
    wabaId: process.env.WABA_ID || "",
    source: "env",
  };
}

/** Les identifiants en vigueur pour l'appel en cours. */
export function courant(): IdentifiantsMeta {
  return stockage.getStore() || identifiantsEnv();
}

/** Exécute `fn` au nom de ces identifiants (et de tout ce qu'elle appelle). */
export function avecIdentifiants<T>(ids: IdentifiantsMeta, fn: () => Promise<T>): Promise<T> {
  return stockage.run(ids, fn);
}
