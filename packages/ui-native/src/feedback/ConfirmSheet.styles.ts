import type { RangDeBouton } from "../core/Button.styles.js";

/* La feuille de confirmation — un titre qui pose la question, une phrase qui
 * dit ce que le geste emporte, l'accord et le refus.
 *
 * AUCUNE COPY ICI. Le titre, la phrase et les deux libellés arrivent de
 * l'appel : la feuille sert les deux langues.
 */

export interface ActionsDeConfirmation {
  rang: RangDeBouton;
  signe: string | null;
  rangDuRefus: RangDeBouton;
}

/* Ce que la feuille décide de ses deux boutons.
 *
 * Le refus ne prend JAMAIS le rang de l'accord : deux boutons de même poids,
 * c'est ainsi qu'on supprime un proche en visant « Annuler ». Il reste au rang
 * `text`, sans fond ni contour — l'accord est le seul objet plein de la
 * feuille.
 *
 * Le signe n'accompagne que l'accord destructeur : une corbeille sur une
 * question ordinaire dramatiserait un geste qui ne défait rien. */
export function actionsDeConfirmation(
  { destructif = false }: { destructif?: boolean } = {},
): ActionsDeConfirmation {
  return {
    rang: destructif ? "destructive" : "primary",
    signe: destructif ? "trash-2" : null,
    rangDuRefus: "text",
  };
}
