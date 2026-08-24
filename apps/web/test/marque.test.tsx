import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { BrandMark, Wordmark } from "../components/ui/index.js";

// Résolu depuis ce fichier, jamais depuis le répertoire courant : un chemin
// littéral comme "apps/web/public..." passe ou échoue selon qu'on lance le
// test depuis la racine du dépôt ou depuis apps/web (pnpm --filter y exécute
// le script avec ce dernier comme répertoire courant) — piège déjà rencontré
// sur ce dépôt.
const PUBLIC = join(import.meta.dirname, "..", "public");

describe("marque", () => {
  it("le logotype porte un nom accessible", () => {
    render(<Wordmark variant="couleur" height={32} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/lehno/i);
  });

  it.each(["couleur", "blanc", "inverse", "uneEncre"] as const)(
    "la variante %s du logotype désigne un fichier réellement servi",
    (variant) => {
      const { container } = render(<Wordmark variant={variant} height={32} />);
      const src = container.querySelector("img")!.getAttribute("src")!;
      expect(existsSync(join(PUBLIC, src)), `manquant : public${src}`).toBe(true);
    },
  );

  it.each(["violet", "ronde", "claire", "encre", "uneEncre"] as const)(
    "la variante %s de la pastille désigne un fichier réellement servi",
    (variant) => {
      const { container } = render(<BrandMark variant={variant} size={64} />);
      const src = container.querySelector("img")!.getAttribute("src")!;
      expect(existsSync(join(PUBLIC, src)), `manquant : public${src}`).toBe(true);
    },
  );

  // Un seul tracé, à toutes les tailles. Sous 128 px, seul le trait s'épaissit —
  // aux paliers matriciels, et jamais en retirant les empattements : « une icône
  // qui perd les empattements devient un autre h »
  // (images/exports/favicon/README.md). Le palier distinct de 28 px a été retiré
  // de la charte, et la bascule qui le servait avec lui.
  it("sert le même tracé à toutes les tailles", () => {
    const { container, unmount } = render(<BrandMark size={28} />);
    expect(container.querySelector("img")!.getAttribute("src")).toBe("/brand/lehno-icone-512.svg");
    unmount();
    const grand = render(<BrandMark size={120} />);
    expect(grand.container.querySelector("img")!.getAttribute("src")).toBe("/brand/lehno-icone-512.svg");
  });

  it("la pastille refuse de descendre sous la taille minimale", () => {
    expect(() => render(<BrandMark size={20} />)).toThrow(/28/);
  });

  // Un manifeste dont les chemins ne résolvent pas donne une icône vide,
  // sans qu'aucune erreur ne le signale.
  it("chaque icône du manifeste existe là où il la déclare", async () => {
    const manifeste = JSON.parse(await readFile(join(PUBLIC, "site.webmanifest"), "utf-8"));
    for (const icone of manifeste.icons)
      expect(existsSync(join(PUBLIC, icone.src)), `manquant : public${icone.src}`).toBe(true);
  });

  it("le manifeste porte les deux usages, ordinaire et masquable", async () => {
    const manifeste = JSON.parse(await readFile(join(PUBLIC, "site.webmanifest"), "utf-8"));
    const usages = manifeste.icons.map((i: { purpose: string }) => i.purpose);
    expect(usages).toContain("any");
    expect(usages).toContain("maskable");
  });
});
