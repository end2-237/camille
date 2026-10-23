// ─────────────────────────────────────────────────────────────────────────────
// L'éditeur visuel ne connaît que des nœuds et des flèches ; le parcours, que
// des blocs et des liens. Ce fichier passe de l'un à l'autre, et chaque geste
// sur le canevas (relier, détacher, supprimer, ajouter) devient une
// modification du parcours — la seule source de vérité.
// ─────────────────────────────────────────────────────────────────────────────

import {
  attend, blocVierge, choixDe, liensDe, nouvelId, TERMINAUX,
  type Bloc, type Declencheur, type Parcours, type Position, type TypeBloc,
} from "@/lib/parcours-regles";

export const PREFIXE_DECL = "declencheur:";
export const estDeclencheur = (id: string) => id.startsWith(PREFIXE_DECL);
export const indexDecl = (id: string) => Number(id.slice(PREFIXE_DECL.length));

/** Les sorties d'un bloc, dans l'ordre où le nœud les affiche. */
export function sortiesDe(b: Bloc): { id: string; libelle: string }[] {
  if (TERMINAUX.includes(b.type)) return [];
  const s: { id: string; libelle: string }[] = choixDe(b).map((c) => ({ id: `choix:${c.id}`, libelle: c.titre || c.id }));
  if (b.type === "position") s.unshift({ id: "suite", libelle: "position reçue" });
  if (attend(b)) s.push({ id: "sinon", libelle: "autre réponse" });
  else s.push({ id: "suite", libelle: "" });
  return s;
}

/** Relie une sortie à un bloc (glisser une flèche). */
export function lier(p: Parcours, source: string, sortie: string, cible: string) {
  if (estDeclencheur(source)) {
    const d = p.declencheurs[indexDecl(source)];
    if (d) d.vers = cible;
    return;
  }
  const b = p.blocs.find((x) => x.id === source);
  if (!b || source === cible) return;
  if (sortie === "suite") {
    if (b.type === "aller") b.vers = cible;
    else b.suite = cible;
  } else if (sortie === "sinon") {
    (b as { sinon?: string }).sinon = cible;
  } else if (sortie.startsWith("choix:")) {
    const c = choixDe(b).find((x) => x.id === sortie.slice(6));
    if (c) c.vers = cible;
  }
}

/** Détache une flèche. */
export function delier(p: Parcours, source: string, sortie: string) {
  if (estDeclencheur(source)) {
    const d = p.declencheurs[indexDecl(source)];
    if (d) d.vers = "";
    return;
  }
  const b = p.blocs.find((x) => x.id === source);
  if (!b) return;
  if (sortie === "suite") {
    if (b.type === "aller") b.vers = "";
    else delete b.suite;
  } else if (sortie === "sinon") {
    delete (b as { sinon?: string }).sinon;
  } else if (sortie.startsWith("choix:")) {
    const c = choixDe(b).find((x) => x.id === sortie.slice(6));
    if (c) delete c.vers;
  }
}

/** Supprime un bloc et tout ce qui pointait vers lui. */
export function supprimerBloc(p: Parcours, id: string) {
  p.blocs = p.blocs.filter((b) => b.id !== id);
  for (const b of p.blocs) {
    if (b.suite === id) delete b.suite;
    if (b.type === "aller" && b.vers === id) b.vers = "";
    const s = b as { sinon?: string };
    if (s.sinon === id) delete s.sinon;
    for (const c of choixDe(b)) if (c.vers === id) delete c.vers;
  }
  for (const d of p.declencheurs) if (d.vers === id) d.vers = "";
  if (p.par_defaut === id) p.par_defaut = "silence";
  if (p.ui?.positions) delete p.ui.positions[id];
}

export function supprimerDeclencheur(p: Parcours, i: number) {
  p.declencheurs.splice(i, 1);
  // Les positions des déclencheurs suivants glissent d'un rang.
  const pos = p.ui?.positions;
  if (!pos) return;
  for (let j = i; j <= p.declencheurs.length; j++) {
    const suivante = pos[`${PREFIXE_DECL}${j + 1}`];
    if (suivante) pos[`${PREFIXE_DECL}${j}`] = suivante;
    else delete pos[`${PREFIXE_DECL}${j}`];
  }
}

/** Renomme un bloc partout où il est cité. */
export function renommer(p: Parcours, ancien: string, nouveau: string): boolean {
  if (!nouveau || ancien === nouveau || p.blocs.some((b) => b.id === nouveau)) return false;
  for (const b of p.blocs) {
    if (b.id === ancien) b.id = nouveau;
    if (b.suite === ancien) b.suite = nouveau;
    if (b.type === "aller" && b.vers === ancien) b.vers = nouveau;
    const s = b as { sinon?: string };
    if (s.sinon === ancien) s.sinon = nouveau;
    for (const c of choixDe(b)) if (c.vers === ancien) c.vers = nouveau;
  }
  for (const d of p.declencheurs) if (d.vers === ancien) d.vers = nouveau;
  if (p.par_defaut === ancien) p.par_defaut = nouveau;
  const pos = p.ui?.positions;
  if (pos?.[ancien]) { pos[nouveau] = pos[ancien]; delete pos[ancien]; }
  return true;
}

/**
 * Ajoute un bloc. S'il est posé depuis un bloc sélectionné dont la suite est
 * libre, il s'y accroche tout seul — comme dans n8n.
 */
export function ajouterBloc(p: Parcours, type: TypeBloc, ou: Position, depuis?: string | null): string {
  const id = nouvelId(p, type);
  p.blocs.push(blocVierge(type, id));
  p.ui = { ...(p.ui || {}), positions: { ...(p.ui?.positions || {}), [id]: ou } };
  if (depuis) {
    if (estDeclencheur(depuis)) {
      const d = p.declencheurs[indexDecl(depuis)];
      if (d && !d.vers) d.vers = id;
    } else {
      const src = p.blocs.find((b) => b.id === depuis);
      if (src && !TERMINAUX.includes(src.type) && !attend(src) && !src.suite && src.type !== "aller") src.suite = id;
    }
  }
  return id;
}

export function ajouterDeclencheur(p: Parcours, d: Declencheur, ou: Position) {
  p.declencheurs.push(d);
  p.ui = { ...(p.ui || {}), positions: { ...(p.ui?.positions || {}), [`${PREFIXE_DECL}${p.declencheurs.length - 1}`]: ou } };
}

// ── Disposition automatique ─────────────────────────────────────────────────

const PAS_X = 260;
const PAS_Y = 200;
const PAR_LIGNE = 5;

/**
 * Une place pour chaque nœud qui n'en a pas. On suit chaque chaîne d'un bout
 * à l'autre (la suite d'abord, les choix ensuite), et on la pose en lignes
 * qui se lisent de gauche à droite : l'accueil No Limit tient sur quatre
 * lignes au lieu de s'étirer sur 5 000 pixels.
 */
export function disposer(p: Parcours, tout = false): Record<string, Position> {
  const pos: Record<string, Position> = tout ? {} : { ...(p.ui?.positions || {}) };
  const voisins = new Map<string, string[]>();
  for (const l of liensDe(p)) {
    const v = voisins.get(l.de) || [];
    // La suite passe avant les choix et le « sinon » : la chaîne principale reste d'un seul tenant.
    if (l.sortie === "suite") v.unshift(l.vers); else v.push(l.vers);
    voisins.set(l.de, v);
  }

  const ordre: string[] = [];
  const vus = new Set<string>();
  const visiter = (n: string) => {
    const pile = [n];
    while (pile.length) {
      const x = pile.pop()!;
      if (vus.has(x)) continue;
      vus.add(x);
      ordre.push(x);
      const v = voisins.get(x) || [];
      for (let i = v.length - 1; i >= 0; i--) if (!vus.has(v[i])) pile.push(v[i]);
    }
  };
  p.declencheurs.forEach((_, i) => visiter(`${PREFIXE_DECL}${i}`));
  for (const b of p.blocs) visiter(b.id);

  let decl = 0;
  let k = 0;
  for (const n of ordre) {
    if (pos[n]) continue;
    if (estDeclencheur(n)) { pos[n] = { x: 0, y: decl++ * 90 }; continue; }
    pos[n] = { x: 280 + (k % PAR_LIGNE) * PAS_X, y: Math.floor(k / PAR_LIGNE) * PAS_Y };
    k++;
  }
  return pos;
}

/** Le résumé d'un bloc affiché sur son nœud. */
export function resume(b: Bloc): string {
  switch (b.type) {
    case "texte": return b.texte;
    case "image": case "video": return b.legende || b.url.split("/").pop() || "";
    case "vocal": return b.url.split("/").pop() || "";
    case "document": return b.nom || b.url.split("/").pop() || "";
    case "lien": return b.url;
    case "bouton_lien": return `${b.libelle} → ${b.url}`;
    case "boutons": case "liste": return b.texte;
    case "position": return b.texte;
    case "reaction": return b.emoji;
    case "pause": return `${b.secondes} s`;
    case "humain": return b.message || "Transfert au commerçant";
    case "aller": return b.vers ? `→ ${b.vers}` : "";
    case "agent": return "L'IA de l'agent prend la suite";
    case "silence": return "Camille se tait";
    case "fin": return "Retour au comportement par défaut";
  }
}

export function libelleDeclencheur(d: Declencheur): string {
  if (d.type === "nouveau_contact") return "Nouveau contact";
  if (d.type === "mot_cle") return `Mot-clé : ${d.mots.filter(Boolean).join(", ") || "…"}`;
  return `Bouton : ${d.id || "…"}`;
}
