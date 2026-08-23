import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../src/App.js";

describe("amorçage du back-office", () => {
  it("rend une région principale", async () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("nomme l'outil", async () => {
    render(<App />);
    expect(screen.getByText("Lehno")).toBeInTheDocument();
  });

  it("pose la classe qui porte la surcharge du back-office", async () => {
    render(<App />);
    // Sans .lehno-admin, l'outil hérite de la densité du produit : contrôles à
    // 44 px et Fraunces en titre. La classe n'est pas décorative.
    expect(document.body).toHaveClass("lehno-admin");
  });
});
