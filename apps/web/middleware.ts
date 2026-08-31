import { NextResponse, type NextRequest } from "next/server";
import { ENTETE_LANGUE, LANGUES, langueDemandee } from "./lib/langues";

export function middleware(requete: NextRequest): NextResponse {
  const { pathname } = requete.nextUrl;
  const prefixe = LANGUES.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (prefixe) {
    /* La langue est reportée en en-tête de la requête transmise.
       `not-found.tsx` est le seul rendu du site qui ne reçoit PAS les
       paramètres de route — Next l'appelle sans segment résolu — et il lui faut
       pourtant la langue : une page d'erreur en anglais servie à quelqu'un
       venu par un lien français est une page d'erreur de plus. */
    const entetes = new Headers(requete.headers);
    entetes.set(ENTETE_LANGUE, prefixe);
    return NextResponse.next({ request: { headers: entetes } });
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
