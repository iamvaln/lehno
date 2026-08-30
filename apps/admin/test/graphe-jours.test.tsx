import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { GrapheJours } from "../src/composants/donnees/index.js";

const LIBELLES = {
  resume: "Encaissé et échoué, par jour",
  haut: "Encaissé",
  bas: "Échoué",
  jour: "Jour",
  vide: "Aucun paiement sur la période.",
};

const JOURS = [
  { jour: "2026-08-28", haut: 1000, bas: 400 },
  { jour: "2026-08-29", haut: 2000, bas: 0 },
];

const format = (v: number) => `${v} F`;

describe("le graphe des jours", () => {
  /* Le dessin ne dit rien à qui ne le voit pas, et les chiffres du jour ne
     figurent nulle part ailleurs sur la page : la table masquée n'est pas un
     supplément, c'est la seule voie. */
  it("double le dessin d'une table lisible", () => {
    render(<GrapheJours jours={JOURS} libelles={LIBELLES} format={format} />);

    const table = screen.getByRole("table");
    expect(within(table).getByText("1000 F")).toBeInTheDocument();
    expect(within(table).getByText("400 F")).toBeInTheDocument();
  });

  it("nomme ce que la table montre", () => {
    render(<GrapheJours jours={JOURS} libelles={LIBELLES} format={format} />);
    expect(screen.getByRole("table", { name: LIBELLES.resume })).toBeInTheDocument();
  });

  /* Les deux séries ne s'empilent pas : empilées, leur somme se lirait comme
     une recette, et l'échec disparaîtrait dans la hauteur du succès. Deux
     rectangles par jour, donc, et jamais un seul. */
  it("dessine deux barres par jour", () => {
    const { container } = render(
      <GrapheJours jours={JOURS} libelles={LIBELLES} format={format} />,
    );
    expect(container.querySelectorAll('rect[data-serie="haut"]')).toHaveLength(2);
    expect(container.querySelectorAll('rect[data-serie="bas"]')).toHaveLength(2);
  });

  /* Une seule échelle pour les deux séries : deux échelles rendraient deux
     barres de même hauteur pour deux montants différents, et le graphe
     mentirait sans qu'on puisse le voir. */
  it("met les deux séries à la même échelle", () => {
    const { container } = render(
      <GrapheJours
        jours={[{ jour: "2026-08-29", haut: 1000, bas: 500 }]}
        libelles={LIBELLES} format={format}
      />,
    );
    const haut = container.querySelector('rect[data-serie="haut"]');
    const bas = container.querySelector('rect[data-serie="bas"]');
    expect(Number(bas?.getAttribute("height"))).toBeCloseTo(Number(haut?.getAttribute("height")) / 2, 1);
  });

  // Une période sans paiement se dit ; un graphe vide se lirait comme une panne.
  it("dit qu'il n'y a rien plutôt que de dessiner du vide", () => {
    render(<GrapheJours jours={[]} libelles={LIBELLES} format={format} />);
    expect(screen.getByText(LIBELLES.vide)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  // Le composant ne met aucun montant en forme : la devise et le séparateur
  // appartiennent à l'appelant, qui sait dans quelle langue il se lit.
  it("n'écrit aucun montant de lui-même", () => {
    render(<GrapheJours jours={JOURS} libelles={LIBELLES} format={(v) => `≈${v}`} />);
    expect(screen.getByText("≈1000")).toBeInTheDocument();
  });
});
