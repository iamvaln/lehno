import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Icon } from "../src/composants/base/Icon.js";
import { Button } from "../src/composants/base/Button.js";
import { BrandMark } from "../src/composants/base/BrandMark.js";
import { TextField } from "../src/composants/base/TextField.js";

describe("Icon", () => {
  it("rend un tracé pour un nom connu", () => {
    const { container } = render(<Icon name="calendar" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("rend un cadre vide pour un nom inconnu, plutôt que de casser la page", () => {
    const { container } = render(<Icon name="ceci-nexiste-pas" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

describe("Button", () => {
  it("porte son libellé et remonte le clic", async () => {
    const clic = vi.fn();
    render(<Button onClick={clic}>Acquitter</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Acquitter" }));
    expect(clic).toHaveBeenCalledOnce();
  });

  it("ne remonte rien quand il est désactivé", async () => {
    const clic = vi.fn();
    render(<Button onClick={clic} disabled>Effacer</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Effacer" }));
    expect(clic).not.toHaveBeenCalled();
  });
});

describe("BrandMark", () => {
  it("refuse de descendre sous le palier de 28 px", () => {
    expect(() => render(<BrandMark size={24} />)).toThrow(/28/);
  });

  // La marque tient sur un seul tracé : sous 128 px, seul le trait s'épaissit aux
  // paliers matriciels, et les empattements ne sont jamais retirés. Le palier
  // distinct de 28 px a été retiré de la charte ; ce test empêche qu'une bascule
  // vers un second dessin revienne par inadvertance.
  it("sert le même tracé à toutes les tailles", () => {
    const { unmount } = render(<BrandMark size={32} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/brand/lehno-icone-512.svg");
    unmount();
    render(<BrandMark size={120} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/brand/lehno-icone-512.svg");
  });
});

describe("TextField", () => {
  it("lie son libellé à son champ", () => {
    render(<TextField label="Motif" />);
    expect(screen.getByLabelText("Motif")).toBeInTheDocument();
  });
});

// Les quatre sont copiés depuis apps/web/components/ui : deux applications, pas
// encore de paquet partagé. Une copie qu'aucun test ne surveille dérive ; celui-ci
// la tient. S'il échoue, c'est qu'il faut soit reporter la correction des deux
// côtés, soit extraire enfin la bibliothèque — pas contourner le test.
describe("aucune dérive avec la bibliothèque du produit", () => {
  for (const nom of ["Icon", "Button", "BrandMark", "TextField"]) {
    it(`${nom}.tsx est identique à celui du produit`, () => {
      const admin = readFileSync(`src/composants/base/${nom}.tsx`, "utf-8");
      const produit = readFileSync(`../web/components/ui/${nom}.tsx`, "utf-8");
      expect(admin).toBe(produit);
    });
  }
});
