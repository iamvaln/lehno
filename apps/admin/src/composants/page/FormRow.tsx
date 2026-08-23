import type { ReactNode } from "react";

export interface FormRowProps {
  label: string;
  /** Ce que le réglage entraîne : « Prend effet dès l'enregistrement. » */
  aide?: string;
  /** **La valeur précédente**, rappelée à côté du champ. */
  precedente?: ReactNode;
  /** Ce qui introduit ce rappel — « Valeur précédente ». */
  libellePrecedente?: string;
  /** L'erreur du champ, déjà formulée. */
  erreur?: string;
  /** Identifiant du champ, quand l'étiquette doit lui être liée. */
  champId?: string;
  children: ReactNode;
}

/** Une ligne de formulaire de configuration.
 *
 *  La spec impose de **rappeler la valeur précédente** sur tout réglage : c'est
 *  ce qui distingue un paramètre qui pilote le produit d'un champ ordinaire — on
 *  voit ce qu'on change avant d'enregistrer. `parametreSchema` porte d'ailleurs
 *  `valeurPrecedente` pour cette seule raison. */
export function FormRow({
  label,
  aide,
  precedente,
  libellePrecedente,
  erreur,
  champId,
  children,
}: FormRowProps) {
  return (
    <div className="admin-rang" data-erreur={erreur ? "true" : undefined}>
      <div className="admin-rang-dire">
        {champId ? (
          <label className="admin-rang-label" htmlFor={champId}>{label}</label>
        ) : (
          <span className="admin-rang-label">{label}</span>
        )}
        {aide ? <p className="admin-rang-aide">{aide}</p> : null}
      </div>
      <div className="admin-rang-champ">
        {children}
        {precedente != null ? (
          <p className="admin-rang-precedente">
            {libellePrecedente ? <span className="admin-rang-precedente-cle">{libellePrecedente}</span> : null}
            <span className="admin-rang-precedente-valeur">{precedente}</span>
          </p>
        ) : null}
        {erreur ? <p className="admin-rang-erreur">{erreur}</p> : null}
      </div>
    </div>
  );
}
