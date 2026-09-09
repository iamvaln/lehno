import * as React from "react";

/**
 * La brique d'échéance — la même sur l'accueil et dans les fiches.
 * @startingPoint section="Contenu" subtitle="La carte imminente et les lignes calmes" viewport="380x460"
 */
export interface EventCardProps extends React.HTMLAttributes<HTMLDivElement> {
  nom: string;
  /** anniversaire est neutre (le cas courant) ; les autres portent un tag. */
  type?: "anniversaire" | "mariage" | "retraite" | "naissance" | "etape" | "autre";
  /** « 24 août » ou « aujourd'hui ». */
  dateLabel?: string;
  jours: number;
  /** Second niveau : « 36 ans », « 5 ans ». */
  precision?: string;
  /** Une note déjà prise — affichée sur la carte imminente seulement. */
  note?: string;
  noteOrigine?: string;
  noteDate?: string;
  /**
   * true : la plus proche échéance — aplat lilas, note visible, **deux actions**.
   * false : une ligne calme, cliquable, sans action.
   * Une seule carte imminente par écran.
   */
  imminent?: boolean;
  /** Libellés des deux actions. Défaut : ["Préparer", "Marquer envoyé"]. */
  actions?: [string, string];
  onPreparer?: () => void;
  onEnvoye?: () => void;
  onOuvrir?: () => void;
}

export declare function EventCard(props: EventCardProps): React.ReactElement;
