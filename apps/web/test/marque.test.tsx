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

  it.each(["violet", "ronde", "claire", "encre", "uneEncre", "favicon"] as const)(
    "la variante %s de la pastille désigne un fichier réellement servi",
    (variant) => {
      const { container } = render(<BrandMark variant={variant} size={64} />);
      const src = container.querySelector("img")!.getAttribute("src")!;
      expect(existsSync(join(PUBLIC, src)), `manquant : public${src}`).toBe(true);
    },
  );

  // Les paliers se redessinent : réduire le grand donne un tracé trop fin.
  it("sous 40 px, la pastille bascule sur le tracé épaissi", () => {
    const { container } = render(<BrandMark size={28} />);
    expect(container.querySelector("img")!.getAttribute("src")).toContain("favicon");
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
