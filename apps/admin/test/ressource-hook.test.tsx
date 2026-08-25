import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useRessource } from "../src/api/hooks.js";
import { ErreurApi } from "../src/api/client.js";

function Sonde({ charger, cle }: { charger: () => Promise<string>; cle: string }) {
  const etat = useRessource(charger, [cle]);
  return (
    <div>
      <span data-testid="statut">{etat.statut}</span>
      <span data-testid="valeur">{etat.statut === "pret" ? etat.donnees : ""}</span>
      <span data-testid="code">{etat.statut === "echec" ? etat.code : ""}</span>
      <button type="button" onClick={etat.recharger}>recharger</button>
    </div>
  );
}

describe("le chargement d'une ressource", () => {
  it("commence par annoncer qu'il charge", () => {
    render(<Sonde cle="a" charger={() => new Promise<string>(() => {})} />);
    expect(screen.getByTestId("statut")).toHaveTextContent("chargement");
  });

  // La course qui compte : un premier appel lent, un second rapide. Sans garde,
  // la réponse tardive du premier écrase la donnée fraîche du second — l'écran
  // affiche alors ce qu'on regardait il y a deux clics, sans rien signaler.
  it("une réponse tardive n'écrase pas celle qui l'a doublée", async () => {
    let repondrePremier: (v: string) => void = () => {};
    const charger = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((tenir) => { repondrePremier = tenir; }))
      .mockImplementationOnce(() => Promise.resolve("le second"));

    const vue = render(<Sonde cle="a" charger={charger} />);
    vue.rerender(<Sonde cle="b" charger={charger} />);
    await waitFor(() => expect(screen.getByTestId("valeur")).toHaveTextContent("le second"));

    repondrePremier("le premier, en retard");

    await new Promise((tenir) => setTimeout(tenir, 10));
    expect(screen.getByTestId("valeur")).toHaveTextContent("le second");
  });

  it("un échec porte le code, ramené à ce que le dictionnaire sait dire", async () => {
    render(<Sonde cle="a" charger={() => Promise.reject(new ErreurApi("not_found", 404))} />);
    await waitFor(() => expect(screen.getByTestId("code")).toHaveTextContent("not_found"));
  });

  // Une erreur qui ne vient pas de l'API — un défaut de rendu, une promesse
  // rejetée à la main — ne doit pas laisser l'écran sans rien dire.
  it("une erreur d'une autre nature retombe sur l'erreur générique", async () => {
    render(<Sonde cle="a" charger={() => Promise.reject(new Error("boum"))} />);
    await waitFor(() => expect(screen.getByTestId("code")).toHaveTextContent("internal_error"));
  });

  it("changer de clé relance le chargement", async () => {
    const charger = vi.fn()
      .mockResolvedValueOnce("pour a")
      .mockResolvedValueOnce("pour b");
    const vue = render(<Sonde cle="a" charger={charger} />);
    await waitFor(() => expect(screen.getByTestId("valeur")).toHaveTextContent("pour a"));

    vue.rerender(<Sonde cle="b" charger={charger} />);

    await waitFor(() => expect(screen.getByTestId("valeur")).toHaveTextContent("pour b"));
    expect(charger).toHaveBeenCalledTimes(2);
  });

  // Un rendu ne doit pas relancer l'appel. La fonction de chargement est
  // recréée à chaque fois par l'appelant ; la suivre en dépendance ferait
  // boucler l'écran sur le serveur.
  it("un rendu de plus, à clé égale, ne rappelle pas le serveur", async () => {
    // Le compteur est partagé, et chaque rendu passe une fonction **neuve** qui
    // l'appelle — c'est exactement ce que fait un écran, dont la fermeture est
    // recréée à chaque rendu. Compter les appels d'une fonction en particulier
    // ne dirait rien : suivre `charger` en dépendance rappellerait la suivante,
    // pas celle-là.
    const serveur = vi.fn().mockResolvedValue("stable");
    const neuve = () => () => serveur() as Promise<string>;

    const vue = render(<Sonde cle="a" charger={neuve()} />);
    await waitFor(() => expect(screen.getByTestId("valeur")).toHaveTextContent("stable"));

    vue.rerender(<Sonde cle="a" charger={neuve()} />);
    vue.rerender(<Sonde cle="a" charger={neuve()} />);

    await new Promise((tenir) => setTimeout(tenir, 10));
    expect(serveur).toHaveBeenCalledTimes(1);
  });
});
