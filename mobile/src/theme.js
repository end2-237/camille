// Design tokens — repris exactement de la maquette fournie.
export const C = {
  bg: "#ECECEC",          // fond gris clair de l'app
  card: "#101012",        // cartes sombres
  cardSoft: "#17171A",
  lime: "#C6F24E",        // accent vert citron
  limeDark: "#B4E23C",
  white: "#FFFFFF",
  ink: "#0E0E10",         // texte foncé sur fond clair
  sub: "#8A8A8E",         // texte secondaire
  subDark: "#9A9AA0",     // texte secondaire sur carte sombre
  line: "#E3E3E3",
  lineDark: "rgba(255,255,255,0.08)",
  green: "#3ECf8E",
  red: "#F87171",
  amber: "#FBBF24",
  chipDark: "#1E1E22",
};

export const R = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };
export const S = { xs: 5, sm: 9, md: 14, lg: 18, xl: 24 };

export const F = {
  h1: { fontSize: 30, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: "700", color: C.ink, letterSpacing: -0.3 },
  card: { fontSize: 16, fontWeight: "700", color: C.white },
  body: { fontSize: 14, color: C.ink },
  sub: { fontSize: 12, color: C.sub },
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

export const BOTTOM_INSET = (() => {
  if (Platform.OS !== "android") return 0;
  const screen = Dimensions.get("screen").height;
  const win = Dimensions.get("window").height;
  const diff = Math.round(screen - win - (StatusBar.currentHeight || 0));
  // Bornes : 0 en navigation par gestes (rien a eviter), 56 au maximum pour
  // qu'une mesure aberrante ne repousse pas la barre au milieu de l'ecran.
  return Math.max(0, Math.min(56, diff));
})();
