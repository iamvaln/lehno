import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { LegalPage } from "../../../components/legal/LegalPage.js";
import { chargerDocumentLegal } from "../../../lib/legal.js";
import type { Langue } from "../../../lib/langues.js";
import { messages } from "../../../messages/index.js";

// La politique de confidentialité, en français.
//
// Le chemin est dans la langue de la page : cette route n'existe qu'en
// français (voir lib/chemins.ts). generateStaticParams ne rend que cette
// langue-là, et dynamicParams la ferme aux autres — « /en/confidentialite » n'a pas
// de sens et doit répondre 404, pas afficher la page.
export const revalidate = 3600;

// Liste vide, à dessein : cette page N'EST PAS pré-rendue à la construction.
// L'image du site se construit dans GitHub Actions, où l'API n'existe pas —
// le repli « contenu indisponible » s'y figeait alors dans la page, et y
// restait une heure. Elle se rend donc à la première visite, quand l'API est
// joignable, puis se met en cache pour la durée ci-dessus.
export function generateStaticParams(): { locale: string }[] {
  return [];
}

type Proprietes = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  // Le chemin est dans une seule langue : « /fr/privacy » n'a pas de sens et
  // doit répondre 404. dynamicParams le faisait avant que la page cesse d'être
  // pré-rendue ; ce contrôle le remplace.
  const { locale } = await params;
  if (locale !== "fr") notFound();
  const langue: Langue = "fr";
  const t = messages(langue);
  const document = await chargerDocumentLegal("confidentialite", langue, revalidate);

  return <LegalPage t={t} langue={langue} kicker={t.confidentialite} document={document} />;
}
