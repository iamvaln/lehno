// Les matcheurs de jest-dom (toHaveTextContent, toBeInTheDocument, toHaveAccessibleName)
// sont enregistrés une fois pour toute la suite.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Sans « globals: true », Testing Library n'enregistre pas son nettoyage : les rendus
// s'empileraient dans le même document et le deuxième test verrait deux h1.
// Le fichier d'amorçage servant aussi aux tests en environnement Node, on ne charge
// le rendu que là où il y a un document.
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}
