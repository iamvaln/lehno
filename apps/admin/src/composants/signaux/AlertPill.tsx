import type { ReactNode } from "react";
import { Icon } from "../base/Icon.js";

/** alerte — ce qui ne va pas · echeance — un délai qui court · info — un fait. */
export type TonAlerte = "alerte" | "echeance" | "info";

export interface AlertPillProps {
  /** L'anomalie en une ligne, déjà formulée : « 22 % d'échecs — Rédaction longue ». */
  children: ReactNode;
  ton?: TonAlerte;
  /** Nom Lucide, quand le ton ne suffit pas à dire de quoi il s'agit. */
  icone?: string;
  /** Rappel que le courriel est déjà parti : « notifié à 14 h ». Le panel et le
   *  mail sont deux vues d'un même événement — on ne prévient pas deux fois. */
  notifie?: string;
  onClick?: () => void;
  /** Le détail au survol : la pastille, elle, ne le porte pas. */
  titre?: string;
}

const ICONES: Record<TonAlerte, string> = {
  alerte: "triangle-alert",
  echeance: "clock",
  info: "info",
};

/** Une anomalie dite en une ligne, cliquable — ni l'état d'un objet (`StatusPill`)
 *  ni un chiffre (`StatCard`). Trois au plus, en rang sous l'en-tête : au-delà,
 *  c'est une liste, pas une alerte. */
export function AlertPill({ children, ton = "alerte", icone, notifie, onClick, titre }: AlertPillProps) {
  const contenu = (
    <>
      <Icon name={icone ?? ICONES[ton]} size={15} />
      <span className="admin-alerte-texte">{children}</span>
      {notifie ? <span className="admin-alerte-notifie">{notifie}</span> : null}
    </>
  );

  if (!onClick) {
    return <div className="admin-alerte" data-ton={ton} title={titre}>{contenu}</div>;
  }

  return (
    <button type="button" className="admin-alerte admin-focus" data-ton={ton} data-cliquable="true" title={titre} onClick={onClick}>
      {contenu}
    </button>
  );
}
