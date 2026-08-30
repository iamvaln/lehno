import { notFound } from "next/navigation";

/* Le fourre-tout qui rattrape les adresses ne correspondant à aucune route.
 *
 * Sans lui, `/fr/nimportequoi` sort du segment `[locale]` et tombe sur la page
 * d'erreur nue de Next : pas d'en-tête, pas de pied, pas de français. Un
 * `app/not-found.tsx` à la racine ne conviendrait pas — la coquille racine de ce
 * site vit SOUS `[locale]`, seul endroit d'où l'on connaît la langue au moment
 * de rendre `<html lang>`, et un second layout racine la dédoublerait.
 *
 * Nest… pardon, Next résout toujours un segment précis avant un fourre-tout :
 * les routes existantes ne passent jamais par ici. Et `[...reste]` exige au
 * moins un segment, donc `/fr` reste la page d'accueil.
 */
export default function Reste(): never {
  notFound();
}
