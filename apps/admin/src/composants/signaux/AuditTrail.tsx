import { Icon } from "../base/Icon.js";

/** Une intervention journalisée. La forme est celle d'`interventionSchema` :
 *  le motif y est requis, parce qu'une entrée sans raison ne prouve rien. */
export interface AuditEntree {
  id?: string;
  date: string;
  auteur: string;
  action: string;
  motif: string;
}

export interface AuditTrailProps {
  entrees: AuditEntree[];
  /** Titre de la section, quand la page en veut un. */
  titre?: string;
  /** Ce qui introduit le motif — « Motif ». */
  libelleMotif?: string;
}

/** « La traçabilité se lit depuis l'objet » (§7) : l'historique des interventions
 *  se consulte en pied de **chaque** page de détail, et pas seulement dans la
 *  section Journal d'audit. En lecture seule — les entrées sont définitives,
 *  c'est ce qui fonde leur valeur de preuve. */
export function AuditTrail({ entrees, titre, libelleMotif }: AuditTrailProps) {
  return (
    <section className="admin-audit">
      {titre ? <h2 className="admin-audit-titre">{titre}</h2> : null}
      <ol className="admin-audit-liste">
        {entrees.map((entree, rang) => (
          <li className="admin-audit-entree" key={entree.id ?? rang}>
            <Icon name="dot" size={15} className="admin-audit-puce" />
            <div className="admin-audit-corps">
              <span className="admin-audit-action">{entree.action}</span>
              {/* Le motif se lit avec l'action, pas ailleurs : c'est lui qui dit
                  pourquoi, et c'est la seule chose qu'un journal doit garantir. */}
              <span className="admin-audit-motif">
                {libelleMotif ? <span className="admin-audit-motif-cle">{libelleMotif}</span> : null}
                <span className="admin-audit-motif-texte">{entree.motif}</span>
              </span>
            </div>
            <div className="admin-audit-meta">
              <span className="admin-audit-auteur">{entree.auteur}</span>
              <span className="admin-audit-date">{entree.date}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
