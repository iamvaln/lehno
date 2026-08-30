import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Invitation } from "../components/surfaces/Invitation.js";
import { messages } from "../messages/index.js";

const t = messages("fr");

const PARRAINAGE = { code: "AWA2026", inviterUsername: "awa", creditsForInvited: 5 };

describe("l'invitation au parrainage", () => {
  it("dit qui invite avant ce que fait le produit", () => {
    render(<Invitation t={t} langue="fr" parrainage={PARRAINAGE} />);
    expect(screen.getByText("awa")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: t.inviteTitre })).toBeInTheDocument();
    expect(screen.getByText(PARRAINAGE.code)).toBeInTheDocument();
  });

  /* La page EST la page d'acquisition : répéter « Découvrir Lehno » sous les
     badges reviendrait à proposer deux fois la même chose dans deux tons
     différents. */
  it("ne porte pas la clôture d'acquisition de la coquille", () => {
    render(<Invitation t={t} langue="fr" parrainage={PARRAINAGE} />);
    expect(screen.queryByText(t.acqTitre)).toBeNull();
  });

  /* Sans code valable il n'y a pas de gain à annoncer : la ligne disparaît,
     les badges restent — celui qui a suivi ce lien voulait installer Lehno. */
  it("garde les badges quand le code ne vaut plus", () => {
    render(<Invitation t={t} langue="fr" parrainage={null} />);
    expect(screen.getByText(t.inviteSansCode)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: t.inviteTitreSansCode })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: t.altApple }).length).toBeGreaterThan(0);
    expect(screen.queryByText(new RegExp(t.inviteGainTexte))).toBeNull();
  });

  /* Un gain à zéro serait une promesse que l'ouverture du compte démentirait. */
  it("n'annonce pas un gain nul", () => {
    render(<Invitation t={t} langue="fr" parrainage={{ ...PARRAINAGE, creditsForInvited: 0 }} />);
    expect(screen.queryByText(new RegExp(t.inviteGainTexte))).toBeNull();
    expect(screen.getByText(PARRAINAGE.code)).toBeInTheDocument();
  });
});
