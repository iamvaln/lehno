import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Introuvable } from "../../components/surfaces/Introuvable.js";
import { ENTETE_LANGUE, estLangue, type Langue } from "../../lib/langues.js";
import { messages } from "../../messages/index.js";

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
  return <Introuvable t={messages(langue)} langue={langue} />;
}
