import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { LegalPage } from "../../../components/legal/LegalPage.js";
import { chargerDocumentLegal } from "../../../lib/legal.js";
import type { Langue } from "../../../lib/langues.js";
import { messages } from "../../../messages/index.js";

// Les mentions légales, en français.
//
// Le chemin est dans la langue de la page : cette route n'existe qu'en
// français (voir lib/chemins.ts). generateStaticParams ne rend que cette
// langue-là, et dynamicParams la ferme aux autres — « /en/mentions-legales » n'a pas
// de sens et doit répondre 404, pas afficher la page.
// Rendue à chaque visite, jamais pré-rendue.
//
// Deux tentatives ont échoué avant celle-ci. Le contenu vient de l'API, qui
// n'existe pas pendant la construction de l'image — dans GitHub Actions, il
// n'y a ni base ni serveur. Le repli « contenu indisponible » se figeait donc
// dans un fichier HTML embarqué dans l'image, et une liste de paramètres vide
// n'y changeait rien : c'est le gabarit parent qui impose les deux langues.
//
// force-dynamic est la seule forme qui garantit que la page voit l'API. Le
// coût est un appel interne de conteneur à conteneur, sur une page qu'on
// visite rarement — moins cher qu'un texte juridique qui ne s'affiche pas.
export const dynamic = "force-dynamic";

type Proprietes = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  // Le chemin est dans une seule langue : « /fr/privacy » n'a pas de sens et
  // doit répondre 404. dynamicParams le faisait avant que la page cesse d'être
  // pré-rendue ; ce contrôle le remplace.
  const { locale } = await params;
  if (locale !== "fr") notFound();
  const langue: Langue = "fr";
  const t = messages(langue);
  const document = await chargerDocumentLegal("mentions", langue, 0);

  return <LegalPage t={t} langue={langue} kicker={t.mentionsLegales} document={document} />;
}
