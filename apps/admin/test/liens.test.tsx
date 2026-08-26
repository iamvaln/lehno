import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Liens } from "../src/pages/Liens.js";
import { LIENS, toutesLesEntrees } from "../src/liens.js";
import { messages, type Langue } from "../src/i18n/index.js";

const t = messages("fr");
const LANGUES: Langue[] = ["fr", "en"];

describe("les liens externes — ux-admin §5.14", () => {
  // Le registre porte le nom et l'adresse, le dictionnaire la phrase d'usage.
  // Deux fichiers pour une entrée : sans ce test, ajouter une console sans sa
  // phrase rendrait une entrée muette, et l'oublier en anglais la rendrait
  // muette pour une moitié de l'équipe seulement.
  it("chaque entrée dit à quoi elle sert, dans les deux langues", () => {
    for (const langue of LANGUES) {
      const usages = messages(langue).liens.usages;
      for (const { cle } of toutesLesEntrees()) {
        expect(
          usages[cle as keyof typeof usages],
          `${langue} : « ${cle} » n'a pas de phrase d'usage`,
        ).toMatch(/\S/);
      }
    }
  });

  // Et l'inverse : une phrase sans entrée est une console qu'on croit avoir
  // rangée là et qu'on ne trouvera jamais.
  it("aucune phrase d'usage ne traîne sans son entrée", () => {
    const cles = new Set(toutesLesEntrees().map((e) => e.cle));
    for (const langue of LANGUES) {
      for (const cle of Object.keys(messages(langue).liens.usages)) {
        expect(cles.has(cle), `${langue} : « ${cle} » décrit une entrée qui n'existe pas`).toBe(true);
      }
    }
  });

  it("chaque groupe porte son titre dans les deux langues", () => {
    for (const langue of LANGUES) {
      const groupes = messages(langue).liens.groupes;
      for (const { groupe } of LIENS) {
        expect(groupes[groupe], `${langue}.liens.groupes.${groupe}`).toMatch(/\S/);
      }
    }
  });

  // Ces adresses sortent de l'outil et s'ouvrent d'un clic. Une adresse relative
  // ou en clair n'a rien à faire dans une page de portes.
  it("toute adresse est absolue et chiffrée", () => {
    for (const { cle, url } of toutesLesEntrees()) {
      expect(url, `« ${cle} » : ${url}`).toMatch(/^https:\/\/[^\s]+$/);
    }
  });

  it("rend chaque entrée sous son groupe", () => {
    render(<Liens />);
    for (const { groupe, entrees } of LIENS) {
      const bloc = screen.getByRole("region", { name: t.liens.groupes[groupe] });
      for (const { nom } of entrees) {
        expect(within(bloc).getByText(nom)).toBeInTheDocument();
      }
    }
  });

  // Un lien qui sort ne doit pas emporter la session de travail ouverte, ni
  // donner à la page visée une poignée sur celle qu'elle quitte — ni lui dire
  // d'où l'on vient. C'est la seule règle de sécurité de cette page, et la
  // seule chose qu'elle puisse casser.
  it("chaque lien sort dans un nouvel onglet, sans poignée ni provenance", () => {
    render(<Liens />);
    for (const { nom, url } of toutesLesEntrees()) {
      const lien = screen.getByRole("link", { name: t.liens.ouvrir.replace("{nom}", nom) });
      expect(lien).toHaveAttribute("href", url);
      expect(lien).toHaveAttribute("target", "_blank");
      expect(lien.getAttribute("rel") ?? "", nom).toMatch(/noreferrer/);
      expect(lien.getAttribute("rel") ?? "", nom).toMatch(/noopener/);
    }
  });

  // Le nom accessible doit annoncer la sortie : qui ne voit pas l'icône ne
  // saurait pas qu'il quitte l'outil.
  it("le nom du lien annonce qu'il ouvre ailleurs", () => {
    render(<Liens />);
    const lien = screen.getAllByRole("link")[0];
    expect(lien?.getAttribute("aria-label") ?? "").toMatch(/nouvel onglet/i);
  });

  it("dit une fois que ces liens ne donnent aucun accès", () => {
    render(<Liens />);
    expect(screen.getByText(t.liens.horsOutil)).toBeInTheDocument();
  });

  it("suit la langue de l'outil", () => {
    render(<Liens langue="en" />);
    expect(screen.getByRole("heading", { level: 1, name: messages("en").liens.titre })).toBeInTheDocument();
  });
});
