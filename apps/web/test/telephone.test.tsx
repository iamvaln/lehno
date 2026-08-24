import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Telephone } from "../components/Telephone.js";

// La Dynamic Island et la barre d'état sont posées en absolu, avec des
// z-index élevés — il le faut, elles couvrent le contenu de l'écran. Mais si
// le cadre n'ouvre pas son propre contexte d'empilement, ces z-index se
// comparent à ceux de la page : l'îlot noir et l'heure passaient alors devant
// l'en-tête collant au défilement, et flottaient au-dessus du menu.
describe("cadre de téléphone", () => {
  it("enferme ses z-index dans son propre contexte d'empilement", () => {
    const { container } = render(<Telephone>contenu</Telephone>);
    const cadre = container.firstElementChild as HTMLElement;

    expect(
      cadre.style.isolation,
      "sans isolation, la barre d'état déborde sur l'en-tête de la page",
    ).toBe("isolate");
  });

  it("porte son heure et sa barre d'accueil sans les annoncer", () => {
    const { container } = render(<Telephone heure="9:41">contenu</Telephone>);
    expect(container.textContent).toContain("9:41");
    const caches = container.querySelectorAll('[aria-hidden="true"]');
    expect(caches.length, "l'habillage du téléphone ne se lit pas").toBeGreaterThanOrEqual(3);
  });
});
