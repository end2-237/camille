// ─────────────────────────────────────────────────────────────────────────────
// Jetons de design.
//
// Direction : surfaces empilées façon iOS récent — un fond neutre, des couches
// translucides posées dessus avec un liseré clair sur l'arête haute et une
// ombre portée large et douce. Ce qui donne l'impression de verre n'est PAS le
// flou : c'est la translucidité, le liseré et l'ombre. Les trois se font en
// JavaScript pur.
//
// C'est un choix, pas un pis-aller : expo-blur est un module natif, l'ajouter
// imposerait un nouveau build APK à tout le monde. Ici tout part par OTA.
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  // ── Fonds ──────────────────────────────────────────────────────────────────
  bg: "#F4F4F7",          // base de l'app, très légèrement bleutée
  bgDeep: "#EAEAF0",      // creux : dessous des surfaces, pistes de jauge
  card: "#101012",        // carte sombre (contenu mis en avant)
  cardSoft: "#17171A",

  // ── Marque ─────────────────────────────────────────────────────────────────
  lime: "#C6F24E",
  limeDark: "#B4E23C",
  limeSoft: "rgba(198,242,78,0.16)",

  // ── Texte ──────────────────────────────────────────────────────────────────
  white: "#FFFFFF",
  ink: "#0E0E10",
  sub: "#8A8A8E",
  subDark: "#9A9AA0",

  // ── Traits ─────────────────────────────────────────────────────────────────
  line: "#E6E6EB",
  lineDark: "rgba(255,255,255,0.08)",

  // ── États ──────────────────────────────────────────────────────────────────
  green: "#34C77B",
  red: "#F87171",
  amber: "#FBBF24",
  chipDark: "#1E1E22",

  // ── Verre ──────────────────────────────────────────────────────────────────
  // `glassLine` est le liseré du HAUT : sur une vraie surface de verre, la
  // lumière accroche l'arête supérieure. C'est ce détail d'un pixel qui fait
  // qu'une carte semble posée sur l'écran plutôt que peinte dedans.
  glass: "rgba(255,255,255,0.78)",
  glassLine: "rgba(255,255,255,0.9)",
  glassEdge: "rgba(17,17,26,0.06)",
  glassDark: "rgba(18,18,21,0.90)",
  glassDarkLine: "rgba(255,255,255,0.16)",

  scrim: "rgba(8,8,12,0.35)",
};

// Rayons : nettement plus ronds qu'avant. Un rayon de 16 sur une carte de
// 340 points de large fait « fenêtre » ; à 26 il fait « objet ».
export const R = { xs: 10, sm: 14, md: 18, lg: 26, xl: 34, pill: 999 };

export const S = { xs: 5, sm: 9, md: 16, lg: 22, xl: 30 };

// ─────────────────────────────────────────────────────────────────────────────
// Ombres.
//
// Une seule règle : l'ombre est LARGE et PEU opaque. Une ombre courte et dense
// fait bouton des années 2010 ; une ombre de 24 points à 8 % fait flottement.
// `elevation` est le pendant Android — sans lui, rien ne s'affiche là-bas.
// ─────────────────────────────────────────────────────────────────────────────
export const SH = {
  soft: {
    shadowColor: "#0B0B14", shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  card: {
    shadowColor: "#0B0B14", shadowOpacity: 0.10, shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 }, elevation: 5,
  },
  float: {
    shadowColor: "#0B0B14", shadowOpacity: 0.20, shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 }, elevation: 12,
  },
};

export const F = {
  // Grand titre d'écran, façon iOS : gros, gras, très resserré.
  large: { fontSize: 34, fontWeight: "800", color: C.ink, letterSpacing: -1.1, lineHeight: 39 },
  h1: { fontSize: 28, fontWeight: "800", color: C.ink, letterSpacing: -0.7 },
  h2: { fontSize: 20, fontWeight: "700", color: C.ink, letterSpacing: -0.4 },
  card: { fontSize: 16, fontWeight: "700", color: C.white },
  body: { fontSize: 15, color: C.ink, lineHeight: 21 },
  sub: { fontSize: 12.5, color: C.sub },
};

// ─────────────────────────────────────────────────────────────────────────────
// Marges systeme Android.
//
// react-native-safe-area-context n'est pas installe, et l'ajouter imposerait un
// nouveau build. Or les deux valeurs se deduisent de l'ecran, en JavaScript pur
// — donc corrigeables par OTA.
//
//   screen  = dalle physique entiere
//   window  = ce que l'app peut peindre
// La difference, c'est le systeme : barre d'etat en haut, barre de navigation
// en bas. On soustrait la premiere pour obtenir la seconde.
// ─────────────────────────────────────────────────────────────────────────────
import { Platform, StatusBar, Dimensions } from "react-native";

export const TOP_INSET =
  Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 4 : 0;

// Hauteur d'une barre a trois boutons sur la plupart des telephones.
const NAV_BAR_3_BOUTONS = 48;

export const BOTTOM_INSET = (() => {
  if (Platform.OS !== "android") return 0;

  const screen = Dimensions.get("screen").height;
  const win = Dimensions.get("window").height;
  const diff = Math.round(screen - win - (StatusBar.currentHeight || 0));

  // diff > 0 : la fenetre s'arrete avant les barres systeme, la mesure est
  // juste. On la borne a 56 pour qu'un telephone exotique ne repousse pas la
  // barre au milieu de l'ecran.
  if (diff > 0) return Math.min(56, diff);

  // diff <= 0 : la fenetre occupe TOUT l'ecran. C'est le cas depuis qu'on
  // declare targetSdk 35 — Android 15 impose le bord-a-bord — et plus rien
  // n'est mesurable en JavaScript seul.
  //
  // Dans le doute on reserve la place d'une barre a trois boutons. Sur un
  // telephone en navigation par gestes cela laisse un peu de vide : c'est
  // desagreable. L'inverse rend les boutons du telephone inutilisables : c'est
  // bloquant. On choisit le desagrement.
  return NAV_BAR_3_BOUTONS;
})();
