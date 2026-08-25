import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Connexion } from "../src/pages/Connexion.js";
import { messages } from "../src/i18n/index.js";

const ADRESSE = "sam@lehno.app";

async function jusquAuCode(utilisateur: ReturnType<typeof userEvent.setup>) {
  await utilisateur.type(screen.getByLabelText(messages("fr").connexion.adresse), ADRESSE);
  await utilisateur.click(screen.getByRole("button", { name: messages("fr").connexion.envoyer }));
  await screen.findByLabelText(messages("fr").connexion.code);
}

async function saisirCode(utilisateur: ReturnType<typeof userEvent.setup>, code = "123456") {
  await utilisateur.type(screen.getByLabelText(messages("fr").connexion.code), code);
  await utilisateur.click(screen.getByRole("button", { name: messages("fr").connexion.entrer }));
}

describe("la connexion traduit le refus, elle ne le devine pas", () => {
  const t = messages("fr");

  // Le contrat commun §2 : le serveur rend un code, l'outil le traduit. Sans
  // ça, l'écran dirait « code refusé » à quelqu'un dont le code a simplement
  // expiré — et lui ferait perdre une tentative pour rien.
  it("un code expiré dit qu'il a expiré, et ne coûte pas de tentative", async () => {
    const utilisateur = userEvent.setup();
    render(<Connexion onVerifierCode={() => "otp_expired"} />);
    await jusquAuCode(utilisateur);
    await saisirCode(utilisateur);

    expect(await screen.findByRole("alert")).toHaveTextContent(t.codes.otp_expired);
    // Le décompte n'apparaît pas : rien n'a été consommé.
    expect(screen.queryByText(t.connexion.faux.replace("{n}", "2"))).not.toBeInTheDocument();
  });

  it("un code faux garde le décompte des tentatives", async () => {
    const utilisateur = userEvent.setup();
    render(<Connexion onVerifierCode={() => "otp_invalid"} />);
    await jusquAuCode(utilisateur);
    await saisirCode(utilisateur);

    expect(await screen.findByRole("alert")).toHaveTextContent(t.connexion.faux.replace("{n}", "2"));
  });

  // Le serveur tient son propre compte, et il est plus fiable que celui de
  // l'écran : un rechargement de page remet le compteur local à trois.
  it("un refus pour trop de tentatives ferme la saisie tout de suite", async () => {
    const utilisateur = userEvent.setup();
    render(<Connexion onVerifierCode={() => "otp_too_many_attempts"} />);
    await jusquAuCode(utilisateur);
    await saisirCode(utilisateur);

    expect(await screen.findByRole("alert")).toHaveTextContent(t.codes.otp_too_many_attempts);
    expect(screen.getByLabelText(t.connexion.code)).toBeDisabled();
  });

  it("une panne de réseau ne se confond pas avec un code refusé", async () => {
    const utilisateur = userEvent.setup();
    render(<Connexion onVerifierCode={() => "reseau_indisponible"} />);
    await jusquAuCode(utilisateur);
    await saisirCode(utilisateur);

    expect(await screen.findByRole("alert")).toHaveTextContent(t.codes.reseau_indisponible);
  });

  it("un booléen reste admis, pour l'aperçu qui n'a pas de serveur", async () => {
    const utilisateur = userEvent.setup();
    const onEntre = vi.fn();
    render(<Connexion onEntre={onEntre} onVerifierCode={() => true} />);
    await jusquAuCode(utilisateur);
    await saisirCode(utilisateur);

    expect(onEntre).toHaveBeenCalled();
  });

  // Chaque code que l'outil peut rencontrer doit avoir sa phrase dans les deux
  // langues. Une clé manquante se voit ici, elle ne se découvre pas en séance.
  it("chaque code a sa traduction dans les deux langues", () => {
    const fr = Object.keys(messages("fr").codes).sort();
    const en = Object.keys(messages("en").codes).sort();
    expect(en).toEqual(fr);
    for (const langue of ["fr", "en"] as const) {
      for (const [cle, phrase] of Object.entries(messages(langue).codes)) {
        expect(phrase, `${langue}.codes.${cle}`).toMatch(/\S/);
      }
    }
  });
});
