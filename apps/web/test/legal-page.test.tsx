import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { render, screen } from "@testing-library/react";
import { LegalPage } from "../components/legal/LegalPage.js";
import { analyserMarkdown } from "../lib/markdown-leger.js";
import { messages } from "../messages/index.js";

// Preuve que chaque page légale affiche vraiment son contenu, dans les deux
// langues : on lit les fichiers réels de apps/api/src/public/legal (jamais
// une chaîne réécrite pour l'occasion), on les fait passer par le même
// analyseur que la page, et on vérifie qu'une phrase précise du document —
// une phrase qui, dans la source, est enroulée sur deux lignes physiques —
// se retrouve bien dans le rendu. import.meta.url, pas process.cwd() : le
// chemin doit résoudre pareil quel que soit le répertoire d'où vitest tourne.
const DOSSIER_LEGAL = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "api", "src", "public", "legal");

function lireDocument(nom: string) {
  const source = readFileSync(join(DOSSIER_LEGAL, nom), "utf-8");
  return analyserMarkdown(source);
}

describe("page légale — contenu réel", () => {
  it("affiche une phrase réelle des CGU françaises, recollée depuis deux lignes physiques", () => {
    const document = lireDocument("cgu.fr.md");
    const { container } = render(<LegalPage t={messages("fr")} langue="fr" kicker="Conditions d'utilisation" document={document} />);
    expect(container.textContent).toContain("régissent l'accès et l'usage du service Lehno");
  });

  it("affiche une phrase réelle des Terms of Use anglais", () => {
    const document = lireDocument("cgu.en.md");
    const { container } = render(<LegalPage t={messages("en")} langue="en" kicker="Terms of Use" document={document} />);
    expect(container.textContent).toContain("govern access to and use of the Lehno service");
  });

  it("affiche une phrase réelle de la confidentialité française", () => {
    const document = lireDocument("confidentialite.fr.md");
    const { container } = render(<LegalPage t={messages("fr")} langue="fr" kicker="Confidentialité" document={document} />);
    expect(container.textContent).toContain("elle n'est pas déléguée à un tiers");
  });

  it("affiche une phrase réelle de la Privacy Policy anglaise", () => {
    const document = lireDocument("confidentialite.en.md");
    const { container } = render(<LegalPage t={messages("en")} langue="en" kicker="Privacy" document={document} />);
    expect(container.textContent).toContain("it is not delegated to a third party");
  });

  it("affiche une phrase réelle des mentions légales françaises", () => {
    const document = lireDocument("mentions.fr.md");
    const { container } = render(<LegalPage t={messages("fr")} langue="fr" kicker="Mentions légales" document={document} />);
    expect(container.textContent).toContain("constitue un transfert hors du Cameroun");
  });

  it("affiche une phrase réelle du Legal Notice anglais", () => {
    const document = lireDocument("mentions.en.md");
    const { container } = render(<LegalPage t={messages("en")} langue="en" kicker="Legal Notice" document={document} />);
    expect(container.textContent).toContain("is a transfer out of Cameroon");
  });

  it("porte le même en-tête et le même pied que la landing", () => {
    const document = lireDocument("cgu.fr.md");
    render(<LegalPage t={messages("fr")} langue="fr" kicker="Conditions d'utilisation" document={document} />);
    expect(screen.getByRole("link", { name: "Confidentialité" })).toHaveAttribute("href", "/fr/confidentialite");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/fr/contact");
  });

  it("porte un seul titre de premier rang, celui du document", () => {
    const document = lireDocument("confidentialite.fr.md");
    render(<LegalPage t={messages("fr")} langue="fr" kicker="Confidentialité" document={document} />);
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent("Politique de confidentialité");
  });

  it("le sommaire relie chaque section à son ancre dans le corps", () => {
    const document = lireDocument("cgu.fr.md");
    const { container } = render(<LegalPage t={messages("fr")} langue="fr" kicker="Conditions d'utilisation" document={document} />);
    // Un identifiant de section peut commencer par un chiffre (« 1-objet ») :
    // valide en HTML, mais un sélecteur CSS #1-objet ne l'est pas sans
    // échappement — d'où getElementById plutôt que querySelector("#...").
    for (const section of document.sections) {
      expect(container.querySelector(`a[href="#${section.id}"]`), `lien de sommaire manquant pour ${section.id}`).not.toBeNull();
      expect(container.querySelector(`[id="${section.id}"]`), `ancre manquante pour ${section.id}`).not.toBeNull();
    }
  });

  it("un document en repli (sections vides) ne casse pas le rendu", () => {
    const document = { titre: "Contenu indisponible", maj: "", chapeau: [], sections: [] };
    render(<LegalPage t={messages("fr")} langue="fr" kicker="Conditions d'utilisation" document={document} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Contenu indisponible");
  });
});
