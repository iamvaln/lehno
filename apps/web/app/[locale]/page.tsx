import type { ReactNode } from "react";
import { ClosingBand } from "../../components/landing/ClosingBand.js";
import { Content } from "../../components/landing/Content.js";
import { Hero } from "../../components/landing/Hero.js";
import { HowItWorks } from "../../components/landing/HowItWorks.js";
import { Pricing } from "../../components/landing/Pricing.js";
import { SiteFooter } from "../../components/landing/SiteFooter.js";
import { SiteHeader } from "../../components/landing/SiteHeader.js";
import { chargerConfig, type ConfigPublique } from "../../lib/config-publique.js";
import { estLangue, type Langue } from "../../lib/langues.js";
import { messages } from "../../messages/index.js";

// La configuration bouge rarement : un cache court suffit, et il évite d'appeler
// l'API à chaque visite d'une page qui, elle, ne change pas.
export const revalidate = 300;

// Next valide le type des props d'une page à la compilation (.next/types) et
// refuse toute propriété qui ne soit pas « params » ou « searchParams » — y
// compris optionnelle. `config` n'existe donc pas en production : il n'est là
// que pour les tests, qui posent leur propre configuration plutôt que de
// simuler un serveur. Le paramètre de la fonction reste donc non typé (`any`,
// le seul échappatoire que Next reconnaît dans son vérificateur généré) ; le
// typage réel reprend dès la première ligne du corps, via `Proprietes`.
type Proprietes = {
  params: Promise<{ locale: string }> | { locale: string };
  config?: ConfigPublique;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- voir le commentaire ci-dessus
export default async function Landing(proprietes: any): Promise<ReactNode> {
  const { params, config } = proprietes as Proprietes;
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);
  const configuration = config ?? (await chargerConfig(revalidate));

  // Un seul booléen bascule le héros et la clôture entre capture d'adresse et
  // badges de magasins. Il vient de l'environnement, pas du code.
  const avantLancement = process.env["NEXT_PUBLIC_LANCEMENT"] !== "1";

  return (
    <div className="page">
      <SiteHeader t={t} langue={langue} />
      <main>
        <Hero t={t} langue={langue} avantLancement={avantLancement} />
        <HowItWorks t={t} />
        <Content t={t} langue={langue} />
        <Pricing t={t} langue={langue} config={configuration} />
        <ClosingBand t={t} langue={langue} avantLancement={avantLancement} />
      </main>
      <SiteFooter t={t} langue={langue} />
    </div>
  );
}
