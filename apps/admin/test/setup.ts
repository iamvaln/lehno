import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Sans « globals: true », Testing Library n'enregistre pas son nettoyage : les
// rendus s'empileraient dans le même document, et le deuxième test verrait deux
// coquilles. Le corps est remis à nu entre deux rendus pour la même raison.
afterEach(() => {
  cleanup();
  document.body.className = "";
});
