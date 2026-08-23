import type { ReactNode } from "react";
import { LegalPage } from "../../../components/legal/LegalPage.js";
import { chargerDocumentLegal } from "../../../lib/legal.js";
import { estLangue, type Langue } from "../../../lib/langues.js";
import { messages } from "../../../messages/index.js";

// Le texte des conditions change rarement — un document juridique ne se
// corrige pas au fil de la journée comme la configuration des prix. Un cache
// plus long que celui de la landing (300s) évite un aller-retour à l'API à
// chaque visite, sans pour autant figer le contenu pour de bon.
export const revalidate = 3600;

// Même forme que app/[locale]/page.tsx : rien que ce que Next lui donne, la
// résolution de la langue et du contenu vit ici, le rendu vit dans
// LegalPage (components/legal/), qui ne connaît rien de Next.
type Proprietes = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);
  const document = await chargerDocumentLegal("cgu", langue, revalidate);

  return <LegalPage t={t} langue={langue} kicker={t.cgu} document={document} />;
}
