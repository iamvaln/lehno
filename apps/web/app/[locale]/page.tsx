import type { ReactNode } from "react";
import { estLangue, type Langue } from "../../lib/langues";
import { messages } from "../../messages";
import { chargerConfig } from "../../lib/config-publique";
import { Entete } from "../../components/Entete";
import { Hero } from "../../components/Hero";
import { Etapes } from "../../components/Etapes";
import { Contenu } from "../../components/Contenu";
import { Mur } from "../../components/Mur";
import { Prix } from "../../components/Prix";
import { Cloture } from "../../components/Cloture";
import { Pied } from "../../components/Pied";

// La configuration bouge rarement : un cache court suffit, et il évite d'appeler
// l'API à chaque visite d'une page qui, elle, ne change pas.
export const revalidate = 300;

// Next valide le type des props d'une page : « params » est une promesse, et toute
// propriété supplémentaire est refusée à la compilation. La configuration ne peut
// donc pas entrer par une prop — elle est lue ici, et les tests posent le serveur.
type Proprietes = { params: Promise<{ locale: string }> };

export default async function Landing({ params }: Proprietes): Promise<ReactNode> {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);
  const configuration = await chargerConfig(revalidate);

  // Un seul booléen bascule le héros et la clôture entre capture d'adresse et
  // badges de magasins. Il vient de l'environnement, pas du code.
  const avantLancement = process.env["NEXT_PUBLIC_LANCEMENT"] !== "1";

  return (
    <div className="page">
      <Entete t={t} langue={langue} />
      <main>
        <Hero t={t} langue={langue} avantLancement={avantLancement} />
        <Etapes t={t} />
        <Contenu t={t} />
        <Mur t={t} />
        <Prix t={t} langue={langue} config={configuration} />
        <Cloture t={t} langue={langue} avantLancement={avantLancement} />
      </main>
      <Pied t={t} langue={langue} />
    </div>
  );
}
