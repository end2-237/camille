// Une illustration « Open Doodles » (Pablo Stanley, CC0), recolorée aux
// couleurs de Camille — public/doodles. Décorative : invisible aux lecteurs
// d'écran. Les fichiers ont un fond blanc : en « multiply », il disparaît
// sur les fonds teintés et seuls les traits et les couleurs restent.

export type NomDoodle =
  | "float" | "laying" | "levitate" | "meditating" | "reading"
  | "selfie" | "sitting-reading" | "unboxing";

export function Doodle({ nom, className, style }: { nom: NomDoodle; className?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/doodles/${nom}.svg`} alt="" aria-hidden="true" draggable={false} className={`select-none ${className || ""}`} style={{ mixBlendMode: "multiply", ...style }} />;
}
