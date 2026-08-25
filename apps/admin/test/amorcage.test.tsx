import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";

describe("amorçage du back-office", () => {
  // L'outil ne s'ouvre plus par défaut : sans session, App rend la connexion.
  // Ces trois-là décrivent l'outil ouvert, on lui en pose donc une.
  beforeEach(() => {
    localStorage.clear();
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin" });
  });

  it("rend une région principale", async () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  // Le mot « Lehno » n'est pas composé : c'est un tracé vectorisé de Fraunces,
  // livré par la charte. La police de l'outil étant Karla, un mot écrit en texte
  // aurait ressemblé au logotype de loin sans en être un. Ce test interdit le
  // retour d'une marque composée.
  it("porte la marque en tracé livré, jamais en texte composé", async () => {
    render(<App />);
    const marques = screen.getAllByRole("img", { name: "Lehno" });
    expect(marques.length).toBeGreaterThan(0);
    for (const marque of marques) {
      expect(marque.getAttribute("src")).toMatch(/verrouillage-horizontal/);
    }
  });

  it("pose la classe qui porte la surcharge du back-office", async () => {
    render(<App />);
    // Sans .lehno-admin, l'outil hérite de la densité du produit : contrôles à
    // 44 px et Fraunces en titre. La classe n'est pas décorative.
    expect(document.body).toHaveClass("lehno-admin");
  });
});
