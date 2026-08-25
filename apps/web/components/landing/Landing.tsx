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
  { t, langue, configuration, avantLancement }: {
    t: Messages;
    langue: Langue;
    configuration: ConfigPublique;
    avantLancement: boolean;
  },
): ReactNode {
  return (
    <PublicShell t={t} langue={langue}>
        <Hero t={t} langue={langue} avantLancement={avantLancement} />
        <HowItWorks t={t} />
        <Content t={t} langue={langue} />
        <WallPreview t={t} langue={langue} />
        <Pricing t={t} langue={langue} config={configuration} />
        <ClosingBand t={t} langue={langue} avantLancement={avantLancement} />
    </PublicShell>
  );
}
