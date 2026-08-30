import type { ReactNode } from "react";
import type { Langue } from "../lib/langues.js";
import type { Messages } from "../messages/index.js";
import { BandeAcquisition, type Acquisition } from "./BandeAcquisition.js";
import { SiteFooter } from "./landing/SiteFooter.js";
import { SiteHeader } from "./landing/SiteHeader.js";

/**
 * Le cadre de toutes les surfaces publiques — landing, pages légales, FAQ,
 * contact, et celles à venir.
 *
 * Ce n'est pas un cadre à part : c'est **le cadre du site**. Un visiteur qui
 * découvre Lehno par une page légale doit pouvoir aller voir ce qu'est Lehno,
 * et revenir. D'où le même en-tête et le même pied que la landing, à
 * l'identique.
 *
 * Il existe parce que quatre écrans l'assemblaient chacun de leur côté. Le code
 * n'était pas dupliqué — l'en-tête et le pied ne sont écrits qu'une fois — mais
 * l'assemblage l'était, et c'est ce qui coûte : le paquet de passation veut le
 * CTA d'acquisition sur *toutes* les pages publiques, plus un bandeau de
 * consentement. Les poser quatre fois, c'est les oublier à la cinquième.
 */
export function PublicShell(
  { t, langue, children, acquisition }: {
    t: Messages;
    langue: Langue;
    children: ReactNode;
    /**
     * L'invitation de pied. **Posée par défaut**, parce que c'est précisément
     * ce qu'on oublie à la cinquième page — et que la coquille existe pour ça.
     *
     * `false` la retire, et seules deux surfaces le font : la landing, qui
     * finit déjà sur son aplat de clôture, et le Mur, qui porte la sienne dans
     * la page. Deux invitations à la suite, c'en est une de trop.
     *
     * Un objet la remplace par une phrase qui parle du contexte plutôt que du
     * produit — « tenez la liste de vos proches » après une collecte dit
     * l'exact retournement de ce qu'on vient de faire.
     */
    acquisition?: Acquisition | false;
  },
): ReactNode {
  return (
    <div className="page">
      <SiteHeader t={t} langue={langue} />
      <main>{children}</main>
      {acquisition === false ? null : (
        <BandeAcquisition
          t={t} langue={langue}
          {...(acquisition ? { acquisition } : {})}
        />
      )}
      <SiteFooter t={t} langue={langue} />
    </div>
  );
}
