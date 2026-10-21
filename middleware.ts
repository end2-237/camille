// ─────────────────────────────────────────────────────────────────────────────
// Les vitrines en sous-domaine : https://<adresse>.<VITRINE_DOMAINE> sert la
// vitrine /s/<adresse>, sans redirection visible.
//
// Inactif tant que VITRINE_DOMAINE n'est pas posé (et que le DNS
// *.<VITRINE_DOMAINE> ne pointe pas sur le serveur) : les vitrines restent
// alors joignables à https://camille.vps.buyticle.com/s/<adresse>.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const domaine = process.env.VITRINE_DOMAINE?.trim().toLowerCase();
  if (!domaine) return NextResponse.next();
  const hote = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  if (!hote.endsWith(`.${domaine}`)) return NextResponse.next();
  const sous = hote.slice(0, -(domaine.length + 1));
  if (!sous || sous.includes(".") || ["www", "camille", "app", "api"].includes(sous)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/s/${sous}${req.nextUrl.pathname === "/" ? "" : req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

// Les fichiers de Next, les images et l'API passent tels quels : la vitrine
// appelle /api/vitrine/… sur son propre sous-domaine.
export const config = {
  matcher: ["/((?!_next/|api/|favicon|.*\\.(?:png|jpg|jpeg|webp|svg|ico|css|js|map|txt|xml)$).*)"],
};
