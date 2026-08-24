import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm } from "../components/contact/ContactForm.js";
import { messages } from "../messages/index.js";

// Même motif que test/formulaire-attente.test.tsx : rien ne prouvait que ce
// formulaire poste réellement, ni qu'il reste utilisable au clavier et que
// ses erreurs s'annoncent — un formulaire qui ne poste nulle part consomme la
// seule tentative que quelqu'un fait pour nous joindre.
describe("formulaire de contact", () => {
  const t = messages("fr");
  let appels: Array<{ url: string; corps: Record<string, unknown> }>;

  const brancherFetch = (reponse: { ok: boolean } | Error): void => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      appels.push({ url, corps: JSON.parse(String(init.body)) });
      if (reponse instanceof Error) throw reponse;
      return reponse as Response;
    }));
  };

  const remplir = async (valeurs: { nom?: string; email?: string; message?: string } = {}): Promise<void> => {
    const { nom = "Awa", email = "awa@example.com", message = "Une question sur mon compte, merci." } = valeurs;
    if (nom) await userEvent.type(screen.getByLabelText(t.contactLabelNom), nom);
    if (email) await userEvent.type(screen.getByLabelText(t.contactLabelEmail), email);
    if (message) await userEvent.type(screen.getByLabelText(t.contactLabelMessage), message);
  };

  beforeEach(() => { appels = []; });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("étiquette chaque champ, y compris le sujet", () => {
    render(<ContactForm t={t} />);
    expect(screen.getByLabelText(t.contactLabelNom)).toBeInTheDocument();
    expect(screen.getByLabelText(t.contactLabelEmail)).toBeInTheDocument();
    expect(screen.getByLabelText(t.contactLabelSujet)).toBeInTheDocument();
    expect(screen.getByLabelText(t.contactLabelMessage)).toBeInTheDocument();
  });

  it("propose les six sujets de la maquette", () => {
    render(<ContactForm t={t} />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(t.contactSujets);
  });

  it("n'autorise pas l'envoi tant que le formulaire n'est pas complet", () => {
    render(<ContactForm t={t} />);
    expect(screen.getByRole("button", { name: t.contactEnvoyer })).toBeDisabled();
  });

  it("signale une adresse mal formée sans bloquer la saisie", async () => {
    render(<ContactForm t={t} />);
    await userEvent.type(screen.getByLabelText(t.contactLabelEmail), "pas-une-adresse");
    expect(await screen.findByText(t.contactEmailErreur)).toBeInTheDocument();
  });

  it("autorise l'envoi une fois nom, adresse et message renseignés", async () => {
    render(<ContactForm t={t} />);
    await remplir();
    expect(screen.getByRole("button", { name: t.contactEnvoyer })).toBeEnabled();
  });

  it("poste sur le chemin public de contact, avec le sujet choisi et la langue", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.lehno.app");
    brancherFetch({ ok: true });
    render(<ContactForm t={t} />);

    await remplir();
    await userEvent.selectOptions(screen.getByLabelText(t.contactLabelSujet), t.contactSujets[2]!);
    await userEvent.click(screen.getByRole("button", { name: t.contactEnvoyer }));

    await waitFor(() => expect(appels).toHaveLength(1));
    expect(appels[0]!.url).toBe("https://api.lehno.app/v1/public/contact");
    expect(appels[0]!.corps).toMatchObject({
      name: "Awa", email: "awa@example.com", subject: "credits_paiements", locale: "fr",
    });
    expect(appels[0]!.corps["renderedAt"]).toBeTypeOf("number");
    expect(appels[0]!.corps["website"]).toBe("");
  });

  it("confirme l'envoi et retire le formulaire", async () => {
    brancherFetch({ ok: true });
    render(<ContactForm t={t} />);

    await remplir();
    await userEvent.click(screen.getByRole("button", { name: t.contactEnvoyer }));

    const confirmation = await screen.findByText(t.contactConfirme);
    expect(confirmation).toBeInTheDocument();
    // Banner « success » porte role="status" : l'annonce se fait sans piéger
    // le focus, contrairement à role="alert" réservé aux erreurs.
    expect(confirmation.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: t.contactEnvoyer })).not.toBeInTheDocument();
  });

  it("annonce l'échec sans perdre ce qui a été saisi", async () => {
    brancherFetch({ ok: false });
    render(<ContactForm t={t} />);

    await remplir();
    await userEvent.click(screen.getByRole("button", { name: t.contactEnvoyer }));

    const erreur = await screen.findByText(t.contactEnvoiErreur);
    expect(erreur.closest('[role="alert"]'), "une erreur s'annonce en alert").not.toBeNull();
    expect(screen.getByLabelText(t.contactLabelNom)).toHaveValue("Awa");
  });

  it("survit à une panne de réseau", async () => {
    brancherFetch(new Error("réseau injoignable"));
    render(<ContactForm t={t} />);

    await remplir();
    await userEvent.click(screen.getByRole("button", { name: t.contactEnvoyer }));

    expect(await screen.findByText(t.contactEnvoiErreur)).toBeInTheDocument();
  });

  // Le champ leurre doit exister pour que le serveur ait quelque chose à
  // examiner, mais rester hors de portée du clavier et des lecteurs d'écran.
  it("porte un champ leurre inatteignable", () => {
    const { container } = render(<ContactForm t={t} />);
    const leurre = container.querySelector<HTMLInputElement>('input[name="website"]');

    expect(leurre, "le leurre doit exister").not.toBeNull();
    expect(leurre!.tabIndex, "hors du parcours clavier").toBe(-1);
    expect(leurre!.closest('[aria-hidden="true"]'), "hors des lecteurs d'écran").not.toBeNull();
    expect(leurre!.autocomplete, "hors du remplissage automatique").toBe("off");
  });

  it("transmet la langue de la page", async () => {
    brancherFetch({ ok: true });
    const tEn = messages("en");
    render(<ContactForm t={tEn} />);

    await userEvent.type(screen.getByLabelText(tEn.contactLabelNom), "Awa");
    await userEvent.type(screen.getByLabelText(tEn.contactLabelEmail), "awa@example.com");
    await userEvent.type(screen.getByLabelText(tEn.contactLabelMessage), "A question about my account.");
    await userEvent.click(screen.getByRole("button", { name: tEn.contactEnvoyer }));

    await waitFor(() => expect(appels).toHaveLength(1));
    expect(appels[0]!.corps["locale"]).toBe("en");
  });
});
