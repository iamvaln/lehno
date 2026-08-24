import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { Connexion, ATTENTE_RENVOI_S, DELAI_REPONSE_MS } from "../src/pages/Connexion.js";
import { Profil } from "../src/pages/Profil.js";
import { profil as profilDemo } from "../src/fixtures/index.js";
import { en, fr } from "../src/i18n/index.js";

// L'entrée du back-office et le compte connecté. Ce qui est tenu ici n'est pas
// de la mise en page : c'est la règle de §5.1 — **l'écran ne dit jamais si un
// compte existe**. Une adresse connue et une adresse inconnue produisent le
// même rendu, mot pour mot, et au même instant : un écran qui répond plus vite
// à une adresse inconnue donne la liste de l'équipe aussi sûrement qu'un
// message « ce compte n'existe pas ».
//
// Le temps est simulé de bout en bout (les deux garde-fous se comptent en
// dizaines de secondes), et les gestes passent par `fireEvent` plutôt que par
// `userEvent` : la frappe de `userEvent` attend un temps réel que les
// minuteries simulées ont justement figé — c'est déjà la règle de
// signaux.test.tsx.

const ADRESSE_CONNUE = profilDemo.email;
const ADRESSE_INCONNUE = "personne@ailleurs.test";
const MASQUE = "{adresse}";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Laisse filer le temps simulé **et** les promesses en attente : le plancher
 *  de réponse de l'écran est une minuterie, la demande de code une promesse. */
async function filer(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const champAdresse = () => screen.getByLabelText(fr.connexion.adresse);
const champCode = () => screen.getByLabelText(fr.connexion.code);
const boutonEnvoyer = () => screen.getByRole("button", { name: fr.connexion.envoyer });
const boutonEntrer = () => screen.getByRole("button", { name: fr.connexion.entrer });
const renvoyerDans = (n: number) =>
  screen.getByRole("button", { name: fr.connexion.renvoyerDans.replace("{n}", String(n)) });

const saisir = (champ: HTMLElement, valeur: string) => fireEvent.change(champ, { target: { value: valeur } });

/** Un clic, puis les promesses que ce clic a lancées. */
async function cliquer(bouton: HTMLElement) {
  fireEvent.click(bouton);
  await filer(0);
}

/** Demande un code et attend le plancher de réponse : l'écran est alors à
 *  l'étape du code. */
async function demanderCode(adresse = ADRESSE_CONNUE) {
  saisir(champAdresse(), adresse);
  await cliquer(boutonEnvoyer());
  await filer(DELAI_REPONSE_MS);
}

// --------------------------------------------------------------------------
// La règle de sécurité : le même rendu, au même instant
// --------------------------------------------------------------------------

describe("ce que l'écran répond à une adresse", () => {
  /** Joue la demande de code de bout en bout et rend le texte de l'écran, avec
   *  l'adresse saisie masquée : ce qui reste ne doit dépendre que de l'écran,
   *  jamais du compte. `latence` simule le temps que met la demande côté
   *  serveur — court pour une adresse inconnue, plus long pour une adresse
   *  qu'on retrouve et à qui l'on envoie vraiment un courriel. */
  async function jouer(adresse: string, latence: number) {
    const onDemanderCode = vi.fn(() => new Promise<void>((tenir) => setTimeout(tenir, latence)));
    render(<Connexion onDemanderCode={onDemanderCode} />);

    saisir(champAdresse(), adresse);
    await cliquer(boutonEnvoyer());

    // Un instant avant le plancher : rien n'a bougé, quelle que soit l'adresse.
    await filer(DELAI_REPONSE_MS - 1);
    const avant = (document.body.textContent ?? "").replaceAll(adresse, MASQUE);

    await filer(1);
    const apres = (document.body.textContent ?? "").replaceAll(adresse, MASQUE);

    cleanup();
    return { avant, apres, onDemanderCode };
  }

  it("répond mot pour mot la même chose à une adresse connue et à une adresse inconnue", async () => {
    const connue = await jouer(ADRESSE_CONNUE, 400);
    const inconnue = await jouer(ADRESSE_INCONNUE, 0);

    expect(inconnue.apres).toBe(connue.apres);
    // Et c'est bien la confirmation d'envoi, pas un écran resté en place.
    expect(connue.apres).toContain(fr.connexion.envoye.replace("{adresse}", MASQUE));
  });

  it("bascule au même instant, que la demande ait été lente ou immédiate", async () => {
    const connue = await jouer(ADRESSE_CONNUE, 400);
    const inconnue = await jouer(ADRESSE_INCONNUE, 0);

    // Avant le plancher, aucune des deux n'a basculé : le temps de réponse ne
    // trahit pas la différence.
    expect(connue.avant).toBe(inconnue.avant);
    expect(connue.avant).not.toContain(fr.connexion.titreCode);
    expect(connue.apres).toContain(fr.connexion.titreCode);
  });

  it("ne demande jamais de mot de passe", async () => {
    render(<Connexion />);
    expect(document.querySelector("input[type=\"password\"]")).toBeNull();

    await demanderCode();
    expect(document.querySelector("input[type=\"password\"]")).toBeNull();
  });

  it("vit hors de la coquille : ni navigation, ni barre haute", () => {
    render(<Connexion />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
  });

  it("ne demande rien tant que l'adresse n'en est pas une", async () => {
    const onDemanderCode = vi.fn();
    render(<Connexion onDemanderCode={onDemanderCode} />);

    saisir(champAdresse(), "sam@");
    expect(boutonEnvoyer()).toBeDisabled();

    await cliquer(boutonEnvoyer());
    await filer(DELAI_REPONSE_MS);
    expect(onDemanderCode).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(fr.connexion.code)).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Le code : six chiffres, trois tentatives
// --------------------------------------------------------------------------

describe("la saisie du code", () => {
  it("n'accepte que six chiffres", async () => {
    render(<Connexion />);
    await demanderCode();

    const champ = champCode();
    saisir(champ, "12ab34cd5678");
    // Les lettres n'entrent pas, et la saisie s'arrête à six chiffres.
    expect(champ).toHaveValue("123456");
    expect(champ).toHaveAttribute("inputmode", "numeric");
    expect(champ).toHaveAttribute("maxlength", "6");
  });

  it("n'ouvre l'entrée qu'à six chiffres", async () => {
    render(<Connexion />);
    await demanderCode();

    expect(boutonEntrer()).toBeDisabled();
    saisir(champCode(), "12345");
    expect(boutonEntrer()).toBeDisabled();
    saisir(champCode(), "123456");
    expect(boutonEntrer()).toBeEnabled();
  });

  it("entre avec un code admis, et remonte l'adresse et le code à l'appelant", async () => {
    const onEntre = vi.fn();
    const onVerifierCode = vi.fn(() => true);
    render(<Connexion onEntre={onEntre} onVerifierCode={onVerifierCode} />);
    await demanderCode(ADRESSE_CONNUE);

    saisir(champCode(), "123456");
    await cliquer(boutonEntrer());

    expect(onVerifierCode).toHaveBeenCalledWith({ email: ADRESSE_CONNUE, code: "123456" });
    expect(onEntre).toHaveBeenCalledTimes(1);
  });

  /** Dans l'aperçu, `000000` est le code refusé — c'est la simulation par
   *  défaut de la page, celle du prototype. */
  async function refuser() {
    saisir(champCode(), "000000");
    await cliquer(boutonEntrer());
  }

  it("décompte les tentatives, puis ferme la saisie au troisième code refusé", async () => {
    const onEntre = vi.fn();
    render(<Connexion onEntre={onEntre} />);
    await demanderCode();

    await refuser();
    expect(screen.getByText(fr.connexion.faux.replace("{n}", "2"))).toBeInTheDocument();

    await refuser();
    expect(screen.getByText(fr.connexion.fauxUn)).toBeInTheDocument();

    await refuser();
    expect(screen.getByText(fr.connexion.epuise)).toBeInTheDocument();
    expect(champCode()).toBeDisabled();
    expect(boutonEntrer()).toBeDisabled();
    expect(onEntre).not.toHaveBeenCalled();
  });

  it("rouvre la saisie quand un nouveau code part", async () => {
    render(<Connexion />);
    await demanderCode();

    await refuser();
    await refuser();
    await refuser();
    expect(champCode()).toBeDisabled();

    await filer(ATTENTE_RENVOI_S * 1000);
    await cliquer(screen.getByRole("button", { name: fr.connexion.renvoyer }));
    await filer(DELAI_REPONSE_MS);

    expect(champCode()).toBeEnabled();
    expect(screen.queryByText(fr.connexion.epuise)).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Le renvoi : trente secondes
// --------------------------------------------------------------------------

describe("le renvoi d'un code", () => {
  it("attend trente secondes, à rebours visible, puis redevient possible", async () => {
    const onDemanderCode = vi.fn();
    render(<Connexion onDemanderCode={onDemanderCode} />);
    await demanderCode(ADRESSE_CONNUE);

    expect(onDemanderCode).toHaveBeenCalledTimes(1);
    expect(renvoyerDans(ATTENTE_RENVOI_S)).toBeDisabled();

    await filer(1000);
    expect(renvoyerDans(ATTENTE_RENVOI_S - 1)).toBeDisabled();

    await filer((ATTENTE_RENVOI_S - 2) * 1000);
    expect(renvoyerDans(1)).toBeDisabled();

    await filer(1000);
    const renvoyer = screen.getByRole("button", { name: fr.connexion.renvoyer });
    expect(renvoyer).toBeEnabled();

    await cliquer(renvoyer);
    await filer(DELAI_REPONSE_MS);
    expect(onDemanderCode).toHaveBeenNthCalledWith(2, { email: ADRESSE_CONNUE });
    // Le compte à rebours repart : on ne peut pas enchaîner les envois.
    expect(renvoyerDans(ATTENTE_RENVOI_S)).toBeDisabled();
  });

  it("revient à l'adresse sans rien avoir dit du compte", async () => {
    render(<Connexion />);
    await demanderCode();

    await cliquer(screen.getByRole("button", { name: fr.connexion.changer }));

    expect(screen.getByRole("heading", { level: 1, name: fr.connexion.titre })).toBeInTheDocument();
    expect(screen.queryByLabelText(fr.connexion.code)).toBeNull();
  });

  it("dit l'échec d'envoi sans rien dire du compte", async () => {
    const onDemanderCode = vi.fn(() => Promise.reject(new Error("réseau")));
    render(<Connexion onDemanderCode={onDemanderCode} />);

    saisir(champAdresse(), ADRESSE_CONNUE);
    await cliquer(boutonEnvoyer());
    await filer(DELAI_REPONSE_MS);

    expect(screen.getByText(fr.connexion.echec)).toBeInTheDocument();
    expect(screen.queryByLabelText(fr.connexion.code)).toBeNull();
  });

  it("se lit dans les deux langues", async () => {
    render(<Connexion langue="en" />);

    expect(screen.getByRole("heading", { level: 1, name: en.connexion.titre })).toBeInTheDocument();
    saisir(screen.getByLabelText(en.connexion.adresse), ADRESSE_CONNUE);
    await cliquer(screen.getByRole("button", { name: en.connexion.envoyer }));
    await filer(DELAI_REPONSE_MS);

    expect(screen.getByText(en.connexion.envoye.replace("{adresse}", ADRESSE_CONNUE))).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------
// Mon profil
// --------------------------------------------------------------------------

describe("mon profil", () => {
  it("rend le compte, son rôle et ce que ce rôle ouvre", () => {
    render(<Profil />);

    expect(screen.getByRole("heading", { level: 1, name: fr.profil.titre })).toBeInTheDocument();
    expect(screen.getAllByText(profilDemo.email).length).toBeGreaterThan(0);
    expect(screen.getByText(fr.barre.roleSupport)).toBeInTheDocument();
    // Ce que le rôle ouvre se dit en clair, pas en liste de permissions.
    expect(screen.getByText(fr.profil.portee.support)).toBeInTheDocument();
    expect(screen.getByText(fr.profil.methode)).toBeInTheDocument();
  });

  it("nomme le rôle d'administrateur et sa portée", () => {
    render(<Profil profil={{ ...profilDemo, role: "admin" }} />);

    expect(screen.getByText(fr.barre.roleAdmin)).toBeInTheDocument();
    expect(screen.getByText(fr.profil.portee.admin)).toBeInTheDocument();
  });

  it("rend les sessions ouvertes et marque celle d'ici", () => {
    render(<Profil />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(profilDemo.sessions.length + 1);
    for (const session of profilDemo.sessions) {
      expect(within(table).getByText(session.appareil, { exact: false })).toBeInTheDocument();
      expect(within(table).getByText(session.depuis)).toBeInTheDocument();
    }
    expect(within(table).getAllByText(fr.profil.ici)).toHaveLength(1);
  });

  it("remonte à l'appelant les sessions fermées, et ne les montre plus", async () => {
    const onFermerSessions = vi.fn();
    render(<Profil onFermerSessions={onFermerSessions} />);

    await cliquer(screen.getByRole("button", { name: fr.profil.fermer }));

    const autres = profilDemo.sessions.filter((session) => !session.courante).map((session) => session.id);
    expect(onFermerSessions).toHaveBeenCalledWith(autres);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).queryByText("Firefox — Windows")).toBeNull();
    expect(screen.queryByRole("button", { name: fr.profil.fermer })).toBeNull();
    expect(screen.getByText(fr.profil.vide.titre)).toBeInTheDocument();
  });

  it("n'offre pas de fermeture quand une seule session est ouverte", () => {
    render(<Profil profil={{ ...profilDemo, sessions: profilDemo.sessions.filter((s) => s.courante) }} />);

    expect(screen.queryByRole("button", { name: fr.profil.fermer })).toBeNull();
    expect(screen.getByText(fr.profil.vide.titre)).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------
// L'adhérence des deux pages
// --------------------------------------------------------------------------

describe("l'adhérence des deux pages", () => {
  const connexion = readFileSync("src/pages/Connexion.tsx", "utf-8");
  const profil = readFileSync("src/pages/Profil.tsx", "utf-8");
  const feuille = readFileSync("src/styles/connexion.css", "utf-8");

  it("ne pose aucun style en ligne", () => {
    expect(connexion).not.toMatch(/style=\{/);
    expect(profil).not.toMatch(/style=\{/);
  });

  it("n'écrit ni couleur, ni ombre, ni rayon en dur dans sa feuille", () => {
    expect(feuille).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(feuille).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    expect(feuille).not.toMatch(/box-shadow/);
    expect(feuille).not.toMatch(/border-radius:\s*\d/);
  });
});
