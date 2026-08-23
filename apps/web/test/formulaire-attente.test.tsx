import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormulaireAttente } from "../components/FormulaireAttente.js";
import { messages } from "../messages/index.js";

// Le formulaire de la liste d'attente est la seule chose que la landing
// demande avant le lancement. Rien ne prouvait qu'il poste réellement — un
// bouton qui ne mène nulle part consomme la seule visite qu'un curieux nous
// accordera, et ne se voit pas au rendu.
describe("formulaire de liste d'attente", () => {
  const t = messages("fr");
  let appels: Array<{ url: string; corps: unknown; entetes: unknown }>;

  const brancherFetch = (reponse: { ok: boolean } | Error): void => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      appels.push({
        url,
        corps: JSON.parse(String(init.body)),
        entetes: init.headers,
      });
      if (reponse instanceof Error) throw reponse;
      return reponse as Response;
    }));
  };

  beforeEach(() => { appels = []; });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("poste l'adresse saisie sur le chemin public de l'API", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.lehno.app");
    brancherFetch({ ok: true });
    render(<FormulaireAttente t={t} />);

    await userEvent.type(screen.getByLabelText(t.emailLabel), "awa@example.com");
    await userEvent.click(screen.getByRole("button", { name: t.cta }));

    await waitFor(() => expect(appels).toHaveLength(1));
    expect(appels[0]!.url).toBe("https://api.lehno.app/v1/public/waitlist");
    expect(appels[0]!.corps).toEqual({ email: "awa@example.com", locale: "fr" });
  });

  it("remercie une fois l'adresse acceptée, et retire le formulaire", async () => {
    brancherFetch({ ok: true });
    render(<FormulaireAttente t={t} />);

    await userEvent.type(screen.getByLabelText(t.emailLabel), "awa@example.com");
    await userEvent.click(screen.getByRole("button", { name: t.cta }));

    expect(await screen.findByText(t.merciTitre)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.cta })).not.toBeInTheDocument();
  });

  // Un refus du serveur et une panne de réseau se ressemblent pour la
  // personne : dans les deux cas elle doit pouvoir réessayer, et le
  // formulaire doit rester là.
  it("dit l'échec sans faire disparaître ce qui a été saisi", async () => {
    brancherFetch({ ok: false });
    render(<FormulaireAttente t={t} />);

    await userEvent.type(screen.getByLabelText(t.emailLabel), "awa@example.com");
    await userEvent.click(screen.getByRole("button", { name: t.cta }));

    expect(await screen.findByText(t.waitlistErreur)).toBeInTheDocument();
    expect(screen.getByLabelText(t.emailLabel)).toHaveValue("awa@example.com");
  });

  it("survit à une panne de réseau", async () => {
    brancherFetch(new Error("réseau injoignable"));
    render(<FormulaireAttente t={t} />);

    await userEvent.type(screen.getByLabelText(t.emailLabel), "awa@example.com");
    await userEvent.click(screen.getByRole("button", { name: t.cta }));

    expect(await screen.findByText(t.waitlistErreur)).toBeInTheDocument();
  });

  // La langue voyage jusqu'au serveur : c'est elle qui décide de la langue du
  // courriel de confirmation.
  it("transmet la langue de la page", async () => {
    brancherFetch({ ok: true });
    render(<FormulaireAttente t={messages("en")} />);

    await userEvent.type(screen.getByLabelText(messages("en").emailLabel), "awa@example.com");
    await userEvent.click(screen.getByRole("button", { name: messages("en").cta }));

    await waitFor(() => expect(appels).toHaveLength(1));
    expect((appels[0]!.corps as { locale: string }).locale).toBe("en");
  });
});
