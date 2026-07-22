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

export const R = { sm: 12, md: 18, lg: 24, xl: 30, pill: 999 };
export const S = { xs: 6, sm: 10, md: 16, lg: 22, xl: 28 };

export const F = {
  h1: { fontSize: 30, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: "700", color: C.ink, letterSpacing: -0.3 },
  card: { fontSize: 16, fontWeight: "700", color: C.white },
  body: { fontSize: 14, color: C.ink },
  sub: { fontSize: 12, color: C.sub },
};
