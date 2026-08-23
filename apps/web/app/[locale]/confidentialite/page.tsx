import type { ReactNode } from "react";
import { LegalPage } from "../../../components/legal/LegalPage.js";
import { chargerDocumentLegal } from "../../../lib/legal.js";
import { estLangue, type Langue } from "../../../lib/langues.js";
import { messages } from "../../../messages/index.js";

// Voir conditions/page.tsx : même raisonnement pour la durée de cache.
export const revalidate = 3600;

type Proprietes = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);
  const document = await chargerDocumentLegal("confidentialite", langue, revalidate);

  return <LegalPage t={t} langue={langue} kicker={t.confidentialite} document={document} />;
}
