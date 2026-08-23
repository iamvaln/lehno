import type { ReactNode } from "react";
import { FaqPage } from "../../../components/faq/FaqPage.js";
import { estLangue, type Langue } from "../../../lib/langues.js";
import { messages } from "../../../messages/index.js";

// Rien que ce que Next lui donne : params, et rien d'autre (voir
// app/[locale]/page.tsx, qui applique la même règle). Le contenu de la FAQ
// ne dépend d'aucune donnée serveur — pas d'appel à /v1/public/config comme
// la landing — la page se rend donc entièrement en statique, sans revalidate.
type Proprietes = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);

  return <FaqPage t={t} langue={langue} />;
}
