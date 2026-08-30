import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PublicWishForm } from "@lehno/contracts";
import { DepotVoeu } from "../components/surfaces/DepotVoeu.js";
import { messages } from "../messages/index.js";

const t = messages("fr");

/* Les bornes se calculent à partir d'aujourd'hui : un test qui figerait les
   dates finirait par tester le passé, et la branche « avant ouverture »
   deviendrait « après fermeture » sans que rien ne casse. */
function jour(decalage: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + decalage);
  return d.toISOString().slice(0, 10);
}

function formulaire(sur: Partial<PublicWishForm> = {}): PublicWishForm {
  return {
    recipientDisplayName: "Awa",
    occurrenceDate: jour(10),
    windowOpensOn: jour(-2),
    windowClosesOn: jour(5),
    isOpen: true,
    ...sur,
  };
}

describe("le dépôt d'un mot", () => {
  it("dit pour qui et pour quand", () => {
    render(<DepotVoeu t={t} langue="fr" jeton="j1" formulaire={formulaire()} />);
    expect(screen.getByRole("heading", { level: 1, name: /Awa/ })).toBeInTheDocument();
  });

  it("ouvre le formulaire pendant la fenêtre", () => {
    render(<DepotVoeu t={t} langue="fr" jeton="j1" formulaire={formulaire()} />);
    expect(screen.getByRole("button", { name: t.voeuxEnvoyer })).toBeInTheDocument();
  });

  /* Hors fenêtre, le formulaire n'est pas grisé — il n'est pas là. Un champ
     désactivé se lit comme une panne ; une phrase qui dit la date se lit comme
     une règle. */
  it("retire le formulaire hors fenêtre, et ne le grise pas", () => {
    render(
      <DepotVoeu
        t={t} langue="fr" jeton="j1"
        formulaire={formulaire({ isOpen: false, windowOpensOn: jour(3), windowClosesOn: jour(9) })}
      />,
    );
    expect(screen.queryByRole("button", { name: t.voeuxEnvoyer })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  /* « Ça s'ouvre le 7 » invite à revenir ; « ça s'est refermé le 7 » clôt. Les
     confondre en un « ce n'est pas ouvert » ferait attendre une réouverture
     qui n'aura pas lieu. */
  it("distingue l'attente de la clôture", () => {
    const { unmount } = render(
      <DepotVoeu
        t={t} langue="fr" jeton="j1"
        formulaire={formulaire({ isOpen: false, windowOpensOn: jour(3), windowClosesOn: jour(9) })}
      />,
    );
    expect(screen.getByText(/s'ouvrent le/)).toBeInTheDocument();
    unmount();

    render(
      <DepotVoeu
        t={t} langue="fr" jeton="j1"
        formulaire={formulaire({ isOpen: false, windowOpensOn: jour(-9), windowClosesOn: jour(-3) })}
      />,
    );
    expect(screen.getByText(/se sont refermés le/)).toBeInTheDocument();
  });

  /* La page s'ouvre MÊME hors fenêtre et rend les bornes : une page qui
     refuserait de se charger ne pourrait pas dire quand revenir. */
  it("donne la date de retour quand c'est fermé", () => {
    render(
      <DepotVoeu
        t={t} langue="fr" jeton="j1"
        formulaire={formulaire({ isOpen: false, windowOpensOn: jour(3), windowClosesOn: jour(9) })}
      />,
    );
    expect(screen.getByText(new RegExp(t.voeuxRevenir))).toBeInTheDocument();
  });
});
