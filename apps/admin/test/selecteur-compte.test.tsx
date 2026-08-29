import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelecteurCompte, type CompteChoisi } from "../src/composants/donnees/index.js";

const LIBELLES = {
  chercher: "Chercher un compte",
  placeholder: "Pseudo ou adresse",
  aucun: "Aucun compte ne correspond",
  solde: "Solde",
  changer: "Changer",
};

const AWA: CompteChoisi = { id: "u-1", pseudo: "awa", email: "awa@exemple.cm", solde: 12 };
const AWAA: CompteChoisi = { id: "u-2", pseudo: "awaa", email: "awaa@exemple.cm", solde: 3 };

/**
 * Un compte ne se tape pas. Sur un écran qui écrit de l'argent, la frappe libre
 * laisse partir un crédit vers une adresse voisine — « valentine@ » et
 * « valentin@ » se ressemblent, et rien ne dit ensuite lequel a été servi.
 */
describe("le sélecteur de compte", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  const poser = (valeur: CompteChoisi | null, onChoisir = vi.fn()) => {
    render(
      <SelecteurCompte
        comptes={[AWA, AWAA]}
        valeur={valeur}
        onChoisir={onChoisir}
        libelles={LIBELLES}
      />,
    );
    return onChoisir;
  };

  /* LE cas. Taper une adresse entière ne vaut pas sélection : tant que rien
     n'est retenu, le formulaire n'a pas de compte. */
  it("taper une adresse ne choisit aucun compte", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const onChoisir = poser(null);

    await utilisateur.type(screen.getByLabelText(LIBELLES.chercher), "awa@exemple.cm");

    expect(onChoisir).not.toHaveBeenCalled();
  });

  it("rend le compte qu'on choisit dans la liste", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const onChoisir = poser(null);

    await utilisateur.click(screen.getByLabelText(LIBELLES.chercher));
    await utilisateur.click(screen.getByRole("option", { name: /awaa/ }));

    expect(onChoisir).toHaveBeenCalledWith(AWAA);
  });

  /* Le compte retenu paraît en clair : pseudo, adresse ET solde. C'est la
     dernière occasion de s'apercevoir qu'on vise la mauvaise personne — deux
     pseudos voisins ne se distinguent que par ce qu'ils portent. */
  it("montre le compte retenu avec son adresse et son solde", () => {
    poser(AWA);

    expect(screen.getByText("awa")).toBeInTheDocument();
    expect(screen.getByText(/awa@exemple\.cm/)).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  // On ne cherche plus, on vérifie : le champ de recherche disparaît.
  it("cesse de proposer une recherche une fois le compte retenu", () => {
    poser(AWA);
    expect(screen.queryByLabelText(LIBELLES.chercher)).toBeNull();
  });

  it("rend la main sur « Changer »", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const onChoisir = poser(AWA);

    await utilisateur.click(screen.getByRole("button", { name: /Changer/ }));

    expect(onChoisir).toHaveBeenCalledWith(null);
  });

  it("se choisit au clavier", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const onChoisir = poser(null);
    const champ = screen.getByLabelText(LIBELLES.chercher);

    await utilisateur.click(champ);
    await utilisateur.keyboard("{ArrowDown}{Enter}");

    expect(onChoisir).toHaveBeenCalledWith(AWAA);
  });

  it("dit quand rien ne correspond", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    render(
      <SelecteurCompte comptes={[]} valeur={null} onChoisir={vi.fn()} libelles={LIBELLES} />,
    );

    await utilisateur.click(screen.getByLabelText(LIBELLES.chercher));

    expect(screen.getByText(LIBELLES.aucun)).toBeInTheDocument();
  });

  // C'est l'appelant qui interroge le serveur : le composant ne filtre pas une
  // liste qu'il ne connaît pas en entier.
  it("remonte ce qui est tapé", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const onChercher = vi.fn();
    render(
      <SelecteurCompte
        comptes={[AWA]} valeur={null} onChoisir={vi.fn()}
        onChercher={onChercher} libelles={LIBELLES}
      />,
    );

    await utilisateur.type(screen.getByLabelText(LIBELLES.chercher), "aw");

    expect(onChercher).toHaveBeenLastCalledWith("aw");
  });
});
