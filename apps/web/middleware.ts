import { NextResponse, type NextRequest } from "next/server";
import { LANGUES, langueDemandee } from "./lib/langues";

export function middleware(requete: NextRequest): NextResponse {
  const { pathname } = requete.nextUrl;
  if (LANGUES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) {
    return NextResponse.next();
  }
  const cible = requete.nextUrl.clone();
  const langue = langueDemandee(requete.headers.get("accept-language"));
  cible.pathname = pathname === "/" ? `/${langue}` : `/${langue}${pathname}`;
  return NextResponse.redirect(cible);
}

export const config = {
  // Ni les ressources de Next, ni les fichiers servis tels quels.
  matcher: ["/((?!_next|favicon.ico|brand|badges|.*\\.[^/]+$).*)"],
};
