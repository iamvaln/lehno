import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ApercuApplication } from "../components/ApercuApplication.js";
import { messages } from "../messages/index.js";

// La maquette v3 remplace le logotype dessiné en HTML ("Le" + h violet + "no")
// par l'image du logotype (exports/lehno-logotype-couleur.svg côté maquette,
// Wordmark côté produit) — déjà fait pour SiteHeader et SiteFooter, mais pas
// pour l'aperçu de téléphone du héros.
describe("aperçu d'application — logotype", () => {
  it("porte le logotype en image, pas en texte dessiné", () => {
    const { container } = render(<ApercuApplication t={messages("fr")} langue="fr" />);
    const images = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(images.some((src) => src?.includes("logotype"))).toBe(true);
  });
});
