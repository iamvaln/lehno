import type { Langue } from "./langues";

// Le franc CFA s'écrit « 100 F » dans la copie de la marque, séparateur d'espace
// pour les milliers. Les autres devises passent par le formatage standard, pour
// que l'ajout d'un pays ne demande pas de retoucher la landing.
const SUFFIXE_FRANC = "F";

export function formaterMontant(montant: number, devise: string, langue: Langue): string {
  const code = devise.toUpperCase();
  if (code === "XAF" || code === "XOF") {
    return `${new Intl.NumberFormat(langue, { useGrouping: true }).format(montant)} ${SUFFIXE_FRANC}`;
  }
  return new Intl.NumberFormat(langue, { style: "currency", currency: code }).format(montant);
}
