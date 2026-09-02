import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { ConfigPublique } from "../../lib/config-publique.js";
import type { Messages } from "../../messages/index.js";
import { ClosingBand } from "./ClosingBand.js";
import { Content } from "./Content.js";
import { Hero } from "./Hero.js";
import { HowItWorks } from "./HowItWorks.js";
import { Pricing } from "./Pricing.js";
import { WallPreview } from "./WallPreview.js";
import { PublicShell } from "../PublicShell.js";

// La landing assemblée : Hero, HowItWorks, Content, WallPreview, Pricing,
// ClosingBand — dans la coquille publique, qui porte l'en-tête et le pied
// communs à toutes les surfaces. Un composant de rendu ordinaire, sans rien de
// propre à Next — c'est page.tsx qui résout la langue, la configuration et
// l'environnement, et les lui passe déjà prêts. Un test peut donc le rendre
// directement, avec sa propre configuration, sans simuler de serveur.
export function Landing(
  { t, langue, configuration, avantLancement, features }: {
    t: Messages;
    langue: Langue;
    configuration: ConfigPublique;
    avantLancement: boolean;
    /* Les fonctionnalités ouvertes, telles que le serveur les a résolues.
       LA PAGE NE PROMET JAMAIS CE QUE LE SERVEUR NE SERT PAS : c'est la règle
       de la maquette, et elle vaut bloc par bloc — pas seulement pour la
       bascule du lancement. */
    features: string[];
  },
): ReactNode {
  const ouvert = (cle: string): boolean => features.includes(cle);

  return (
    // L'aplat de clôture ci-dessous porte déjà l'invitation, et avec plus de
    // force : c'est la fin d'un argumentaire, pas une porte de sortie.
    <PublicShell t={t} langue={langue} acquisition={false}>
        <Hero t={t} langue={langue} avantLancement={avantLancement} ouvert={ouvert} />
        <HowItWorks t={t} />
        <Content t={t} langue={langue} ouvert={ouvert} />
        {/* Le Mur ne s'annonce pas s'il n'existe pas. */}
        {ouvert("wall") ? <WallPreview t={t} langue={langue} ouvert={ouvert} /> : null}
        <Pricing t={t} langue={langue} config={configuration} ouvert={ouvert} />
        <ClosingBand t={t} langue={langue} avantLancement={avantLancement} />
    </PublicShell>
  );
}
