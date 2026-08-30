import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PublicWall } from "@lehno/contracts";
import { Mur } from "../components/surfaces/Mur.js";
import { AvisCourt } from "../components/surfaces/AvisCourt.js";
import { messages } from "../messages/index.js";

const t = messages("fr");

const MUR: PublicWall = {
  username: "awa",
  displayName: "Awa",
  welcomeMessage: "Passez me dire bonjour.",
  birthday: "03-07",
  interests: [{ kind: "hobby", value: "Afrobeat" }],
  wishLinkToken: "jeton-123",
};

/**
 * Le Mur est la seule surface où la marque ne parle pas en son nom : c'est son
 * propriétaire qui s'adresse à ses proches.
 */
describe("le Mur public", () => {
  it("présente la personne avant tout le reste", () => {
    render(<Mur t={t} langue="fr" mur={MUR} />);
    expect(screen.getByRole("heading", { level: 1, name: "Awa" })).toBeInTheDocument();
    expect(screen.getByText(MUR.welcomeMessage as string)).toBeInTheDocument();
  });

  /* L'année ne se rend jamais : le Mur annonce un anniversaire, pas une date de
     naissance. L'afficher dirait l'âge à tout visiteur. */
  it("rend le jour et le mois, jamais l'année", () => {
    render(<Mur t={t} langue="fr" mur={MUR} />);
    expect(screen.getByText(/7 mars/)).toBeInTheDocument();
    expect(screen.queryByText(/2000|1990/)).toBeNull();
  });

  it("mène au dépôt de vœux quand il est ouvert", () => {
    render(<Mur t={t} langue="fr" mur={MUR} />);
    const lien = screen.getByRole("link", { name: t.murDeposer });
    expect(lien.getAttribute("href")).toBe("/fr/v/jeton-123");
  });

  /* Le jeton nul recouvre trois causes — pas d'occasion, fenêtre fermée,
     drapeau éteint — et le serveur les résout. La page ne propose donc jamais un
     bouton qui mènerait à un 404 : un bouton qui n'ouvre rien est pire que pas
     de bouton. */
  it("garde le fait sans le bouton quand les vœux sont fermés", () => {
    render(<Mur t={t} langue="fr" mur={{ ...MUR, wishLinkToken: null }} />);
    expect(screen.queryByRole("link", { name: t.murDeposer })).toBeNull();
    expect(screen.getByText(t.murVoeuxFermes)).toBeInTheDocument();
  });

  /* Tout est facultatif, et un bloc absent ne se remplace par rien : une
     vitrine à moitié vide reste une vitrine, alors qu'un emplacement vide
     signalé se lit comme un défaut. */
  it("ne remplace rien quand un bloc manque", () => {
    render(
      <Mur
        t={t} langue="fr"
        mur={{ ...MUR, welcomeMessage: null, birthday: null, interests: [] }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Awa" })).toBeInTheDocument();
    expect(screen.queryByText(t.murAnniversaire)).toBeNull();
    expect(screen.queryByText(t.murInterets)).toBeNull();
  });

  /* L'invitation vit dans la page, en pied — la coquille n'en pose donc pas
     une seconde. Deux invitations à la suite, c'en est une de trop. */
  it("porte son invitation une seule fois", () => {
    render(<Mur t={t} langue="fr" mur={MUR} />);
    expect(screen.getByText(t.murInvitation)).toBeInTheDocument();
    expect(screen.queryByText(t.acqTitre)).toBeNull();
  });
});

describe("l'avis court", () => {
  /* Ce qui s'est passé, et la suite. Un visiteur arrivé par le lien d'une amie
     n'a pas besoin d'être consolé, il a besoin de savoir quoi faire. */
  it("porte l'information dans le titre et offre la sortie", () => {
    render(
      <AvisCourt
        t={t} langue="fr"
        titre={t.etatIndisponibleTitre} texte={t.etatIndisponibleTexte}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: t.etatIndisponibleTitre })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.etatRetour })).toBeInTheDocument();
  });
});
