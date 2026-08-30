import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Introuvable } from "../../components/surfaces/Introuvable.js";
import { ENTETE_LANGUE, estLangue, type Langue } from "../../lib/langues.js";
import { messages } from "../../messages/index.js";
import { themeCss, themeSansScript } from "../../lib/theme-css.js";

/* Le seul rendu du site qui ne reçoit PAS les paramètres de route : Next
 * appelle `not-found` sans segment résolu. La langue vient donc de l'en-tête
 * posé par le middleware — qui, lui, l'a lue dans le chemin.
 *
 * Lire `headers()` force le rendu à la demande, et c'est voulu : une page
 * d'erreur figée à la construction serait figée dans une seule langue. */
export default async function Introuvee(): Promise<ReactNode> {
  const entetes = await headers();
  const annoncee = entetes.get(ENTETE_LANGUE);
  const langue: Langue = annoncee !== null && estLangue(annoncee) ? annoncee : "fr";

  return (
    <>
      {/* Cette page-ci N'EST PAS enveloppée par `[locale]/layout.tsx`.
          Next sert `not-found` dans sa propre coquille (`<html
          id="__next_error__">`), sans `lang`, sans jetons de thème et sans
          polices — et c'est souvent la PREMIÈRE page de Lehno qu'on voit, en
          arrivant par un lien mort.

          Déplacer la coquille dans un layout racine réglerait tout d'un coup,
          mais elle devrait alors lire l'en-tête de langue : `headers()` à la
          racine rend TOUT l'arbre dynamique, et les neuf pages statiques du
          site — la landing comprise — perdraient leur pré-rendu. Le prix est
          trop lourd pour une page d'erreur.

          Elle porte donc son thème elle-même, par une requête média plutôt
          que par la classe habituelle : React remet le `className` de `<html>`
          à l'hydratation — cette coquille-là n'a pas `suppressHydrationWarning`
          — et la page repassait en clair sous les yeux du visiteur.

          La langue, elle, se pose par script : moins solide qu'un attribut de
          balisage, mais un lecteur d'écran lit le DOM, et rien ne la reprend. */}
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <style dangerouslySetInnerHTML={{ __html: themeSansScript }} />
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(langue)}` }} />
      <Introuvable t={messages(langue)} langue={langue} />
    </>
  );
}
