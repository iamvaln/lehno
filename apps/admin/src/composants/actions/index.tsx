// Les trois composants qui gouvernent ce qu'on peut faire : ce que le rôle
// autorise, ce qu'une action sensible exige avant d'avoir lieu, et ce qu'une
// sortie de données emporte. Ils ne portent pas de texte — les libellés
// arrivent en props, la teinte et la mise en page dans styles/signaux.css.
export { RoleGate, type RoleGateProps } from "./RoleGate.js";
export {
  ConfirmWithReason,
  type ConfirmWithReasonProps,
  type LibellesConfirmation,
} from "./ConfirmWithReason.js";
export { ExportButton, type ExportButtonProps, type LibellesExport } from "./ExportButton.js";
