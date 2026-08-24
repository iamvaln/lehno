import type { ReactNode } from "react";
import { LegalPage } from "../../../components/legal/LegalPage.js";
import { chargerDocumentLegal } from "../../../lib/legal.js";
import type { Langue } from "../../../lib/langues.js";
import { messages } from "../../../messages/index.js";

// Les mentions légales, en anglais.
//
// Le chemin est dans la langue de la page : cette route n'existe qu'en
// anglais (voir lib/chemins.ts). generateStaticParams ne rend que cette
// langue-là, et dynamicParams la ferme aux autres — « /fr/legal-notice » n'a pas
// de sens et doit répondre 404, pas afficher la page.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams(): { locale: string }[] {
  return [{ locale: "en" }];
}

export default async function Page(): Promise<ReactNode> {
  const langue: Langue = "en";
  const t = messages(langue);
  const document = await chargerDocumentLegal("mentions", langue, revalidate);

  return <LegalPage t={t} langue={langue} kicker={t.mentionsLegales} document={document} />;
}
