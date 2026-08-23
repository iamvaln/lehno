import type { ReactNode } from "react";
import { Landing } from "../../components/landing/Landing.js";
import { chargerConfig } from "../../lib/config-publique.js";
import { estLangue, type Langue } from "../../lib/langues.js";
import { messages } from "../../messages/index.js";

// La configuration bouge rarement : un cache court suffit, et il évite d'appeler
// l'API à chaque visite d'une page qui, elle, ne change pas.
export const revalidate = 300;

// Rien que ce que Next lui donne : params, et rien d'autre — le vérificateur de
// pages généré par Next (.next/types) refuse toute propriété en trop, même
// optionnelle. La résolution de la langue, de la configuration et de
// l'environnement se fait ici ; le rendu, lui, vit dans Landing
// (components/landing/Landing.tsx), qui ne connaît rien de Next et se teste
// donc directement, sans simuler de serveur.
type Proprietes = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);
  const configuration = await chargerConfig(revalidate);

  // Un seul booléen bascule le héros et la clôture entre capture d'adresse et
  // badges de magasins. Il vient de l'environnement, pas du code.
  const avantLancement = process.env["NEXT_PUBLIC_LANCEMENT"] !== "1";

  return <Landing t={t} langue={langue} configuration={configuration} avantLancement={avantLancement} />;
}
