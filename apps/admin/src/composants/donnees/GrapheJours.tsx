import type { CSSProperties, ReactElement } from "react";

export interface JourGraphe {
  jour: string;
  /** Deux mesures du même jour, jamais les parts d'un total. */
  haut: number;
  bas: number;
}

export interface LibellesGraphe {
  /** Ce que le graphe montre, pour qui ne le voit pas. */
  resume: string;
  haut: string;
  bas: string;
  jour: string;
  vide: string;
}

export interface GrapheJoursProps {
  jours: JourGraphe[];
  libelles: LibellesGraphe;
  /** Met les montants en forme — le composant n'en met aucun. */
  format: (valeur: number) => string;
}

const HAUTEUR = 160;
const ECART = 2;

/**
 * Deux séries par jour, en barres.
 *
 * **Elles ne s'empilent pas.** Encaissé et échoué sont deux mesures du même
 * jour, pas les parts d'un total : empilées, leur somme se lirait comme une
 * recette, et l'échec disparaîtrait dans la hauteur du succès.
 *
 * **Le dessin double une table**, masquée à l'œil et lue par les technologies
 * d'assistance. Un `aria-label` résumant « encaissé et échoué sur trente
 * jours » dirait de quoi il s'agit sans donner un seul chiffre — or les chiffres
 * du jour ne figurent nulle part ailleurs sur la page.
 *
 * Aucune couleur écrite ici : les deux séries portent un attribut, et la teinte
 * se décide dans la feuille, où elle peut différer entre les deux thèmes.
 */
export function GrapheJours({ jours, libelles, format }: GrapheJoursProps): ReactElement {
  if (jours.length === 0) {
    return <p className="admin-section-sous">{libelles.vide}</p>;
  }

  // L'échelle vient du plus grand des DEUX séries : deux échelles rendraient
  // deux barres de même hauteur pour deux montants différents.
  const sommet = Math.max(...jours.flatMap((j) => [j.haut, j.bas]), 1);
  const largeur = Math.max(jours.length * 12, 120);
  const pas = largeur / jours.length;
  const barre = Math.max((pas - ECART * 3) / 2, 1);

  return (
    <>
      <svg
        className="admin-graphe"
        viewBox={`0 0 ${largeur} ${HAUTEUR}`}
        preserveAspectRatio="none"
        role="presentation"
        style={{ width: "100%", height: HAUTEUR }}
      >
        {jours.map((j, rang) => {
          const x = rang * pas + ECART;
          return (
            <g key={j.jour}>
              <rect
                data-serie="haut"
                x={x}
                y={HAUTEUR - (j.haut / sommet) * HAUTEUR}
                width={barre}
                height={(j.haut / sommet) * HAUTEUR}
              />
              <rect
                data-serie="bas"
                x={x + barre + ECART}
                y={HAUTEUR - (j.bas / sommet) * HAUTEUR}
                width={barre}
                height={(j.bas / sommet) * HAUTEUR}
              />
            </g>
          );
        })}
      </svg>

      {/* La même chose en chiffres. Masquée à l'œil, jamais au lecteur d'écran :
          `display: none` la retirerait aussi de lui. */}
      <table style={HORS_VUE}>
        <caption>{libelles.resume}</caption>
        <thead>
          <tr>
            <th scope="col">{libelles.jour}</th>
            <th scope="col">{libelles.haut}</th>
            <th scope="col">{libelles.bas}</th>
          </tr>
        </thead>
        <tbody>
          {jours.map((j) => (
            <tr key={j.jour}>
              <th scope="row">{j.jour}</th>
              <td>{format(j.haut)}</td>
              <td>{format(j.bas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const HORS_VUE: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};
