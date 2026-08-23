import type { ReactNode } from "react";
import { ContactPage } from "../../../components/contact/ContactPage.js";
import { estLangue, type Langue } from "../../../lib/langues.js";
import { messages } from "../../../messages/index.js";

// Rien que ce que Next lui donne : params, et rien d'autre — voir la même
// remarque dans page.tsx (racine). Aucune donnée externe n'entre ici : la
// page ne dépend que de la table de messages, donc rien à revalider — elle se
// construit une fois pour toutes, comme le reste du site statique.
type Proprietes = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);

  return <ContactPage t={t} langue={langue} />;
}
