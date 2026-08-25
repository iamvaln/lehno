import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { PublicShell } from "../components/PublicShell.js";
import { messages } from "../messages/index.js";

const t = messages("fr");

describe("la coquille publique", () => {
  it("pose l'en-tête, une seule région principale, et le pied", () => {
    const { container } = render(<PublicShell t={t} langue="fr"><p>contenu</p></PublicShell>);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(container.querySelectorAll("main")).toHaveLength(1);
  });

  it("rend le contenu qu'on lui confie, entre les deux", () => {
    render(<PublicShell t={t} langue="fr"><p>contenu</p></PublicShell>);
    const principal = screen.getByRole("main");
    expect(principal).toHaveTextContent("contenu");

    // L'ordre du document compte pour la navigation au clavier et pour les
    // lecteurs d'écran : l'en-tête avant le contenu, le pied après.
    const entete = screen.getByRole("banner");
    const pied = screen.getByRole("contentinfo");
    expect(entete.compareDocumentPosition(principal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(principal.compareDocumentPosition(pied) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// Le garde-fou qui justifie l'extraction. Sans lui, la coquille existe mais
// rien n'oblige à s'en servir : le prochain écran public réassemblera à la
// main, et le jour où la coquille gagne le bandeau de consentement ou le CTA
// d'acquisition — que le paquet veut sur *toutes* les pages publiques — il
// l'oubliera sans que personne ne le voie.
describe("personne n'assemble la coquille à la main", () => {
  const racine = join(process.cwd(), "components");

  const fichiers = (dossier: string): string[] =>
    readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
      const chemin = join(dossier, e.name);
      if (e.isDirectory()) return fichiers(chemin);
      return e.name.endsWith(".tsx") ? [chemin] : [];
    });

  // SiteHeader et SiteFooter se définissent chez eux, et ne s'emploient que
  // dans la coquille. Partout ailleurs, on passe par PublicShell.
  const AUTORISES = new Set(["PublicShell.tsx", "SiteHeader.tsx", "SiteFooter.tsx"]);

  it.each(fichiers(racine).map((f) => [f.slice(racine.length + 1), f]))(
    "%s n'importe pas SiteHeader ni SiteFooter",
    (nom, chemin) => {
      if (AUTORISES.has(nom.split("/").pop() ?? "")) return;
      const source = readFileSync(chemin, "utf-8");
      expect(source).not.toMatch(/import\s*\{[^}]*Site(Header|Footer)/);
    },
  );
});
