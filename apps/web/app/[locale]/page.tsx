import type { ReactNode } from "react";
import { Landing } from "../../components/landing/Landing.js";
import { chargerConfig, chargerFeatures } from "../../lib/config-publique.js";
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
  const [configuration, features] = await Promise.all([
    chargerConfig(revalidate),
    chargerFeatures(revalidate),
  ]);

  // Un seul booléen bascule le héros et la clôture entre capture d'adresse et
  // badges de magasins. Il vient du drapeau "launch.live", servi par
  // /public/features (registre en packages/contracts/src/flags.ts), et non
  // d'une variable cuite dans l'image au build : une bascule au jour du
  // lancement doit être un clic en administration, pas une chaîne de
  // livraison.
  //
  // Clé absente = pré-lancement, y compris quand la cause est une panne d'API.
  // C'est une décision, expliquée sur chargerFeatures dans config-publique.ts.
  //
  // Ce booléen peut mettre jusqu'à `revalidate` (300s, cinq minutes) à
  // refléter un changement : le cache de la page, pas une bascule instantanée.
  const avantLancement = !features.includes("launch.live");

  return <Landing t={t} langue={langue} configuration={configuration} avantLancement={avantLancement} />;
}
