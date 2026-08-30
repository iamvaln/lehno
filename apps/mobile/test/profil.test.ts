import { describe, expect, it } from "vitest";
import { updateProfileSchema, type Profile } from "@lehno/contracts";
import {
  corpsDeMiseAJour, doitVerifierLaDisponibilite, peutEnregistrer, pseudoRecevable,
  type SaisieDeProfil,
} from "../lib/profil.js";

const PROFIL: Profile = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "valentine",
  displayName: "Valentine",
  avatarUrl: null,
  email: "valentine@exemple.fr",
  emailVerified: true,
  uiLanguage: "fr",
  theme: "system",
  timezone: "Africa/Douala",
  sendHour: 9,
  gender: null,
};

const tel_quel = (): SaisieDeProfil => ({
  pseudo: PROFIL.username,
  nom: PROFIL.displayName ?? "",
  genre: PROFIL.gender,
  langue: PROFIL.uiLanguage,
});

describe("ce qu'on envoie", () => {
  it("n'envoie rien quand rien n'a changé", () => {
    expect(corpsDeMiseAJour(tel_quel(), PROFIL)).toEqual({});
  });

  /* Le schéma est PARTIEL, et c'est une invitation à n'envoyer que le modifié.
     Tout renvoyer écraserait ce qu'une autre session vient de changer sur le
     même compte — et écrirait des champs que personne n'a touchés. */
  it("n'envoie que ce qui a changé", () => {
    expect(corpsDeMiseAJour({ ...tel_quel(), genre: "female" }, PROFIL))
      .toEqual({ gender: "female" });
  });

  /* LA DIVERGENCE AVEC LA MAQUETTE, tenue par un test. Le kit dessine
     l'adresse en champ modifiable ; `updateProfileSchema` ne l'accepte pas —
     c'est le moyen de connexion, la changer bascule l'identité du compte et
     demande de vérifier la nouvelle avant que l'ancienne ne cesse de valoir.
     Un corps qui la porterait serait refusé en bloc, emportant le reste. */
  it("ne porte jamais l'adresse, ni la photo", () => {
    const corps = corpsDeMiseAJour({ ...tel_quel(), nom: "Val" }, PROFIL);
    expect(corps).not.toHaveProperty("email");
    expect(corps).not.toHaveProperty("avatarUrl");
  });

  // Le corps composé repasse dans le schéma RÉEL : c'est lui qui décide, pas
  // l'idée qu'on s'en fait.
  it("compose un corps que le contrat accepte", () => {
    const corps = corpsDeMiseAJour(
      { pseudo: "valou", nom: "Val", genre: "female", langue: "en" }, PROFIL,
    );
    expect(updateProfileSchema.safeParse(corps).success).toBe(true);
  });

  /* Un nom vidé redevient NUL, pas chaîne vide. Une chaîne vide serait un nom
     qui existe et ne s'affiche pas : l'interface écrirait un blanc là où elle
     attend quelqu'un. */
  it("rend le nom effacé à sa valeur nulle", () => {
    expect(corpsDeMiseAJour({ ...tel_quel(), nom: "   " }, PROFIL))
      .toEqual({ displayName: null });
  });
});

describe("le pseudo", () => {
  /* La règle n'est pas réécrite ici : on appelle le schéma du contrat, qui la
     déclare une seule fois. Deux formulaires du même champ acceptaient
     autrefois des pseudos différents. */
  it("suit la règle du contrat, sans la recopier", () => {
    expect(pseudoRecevable("valentine")).toBe(true);
    expect(pseudoRecevable("va")).toBe(false);
    expect(pseudoRecevable("_valentine")).toBe(false);
    expect(pseudoRecevable("valen tine")).toBe(false);
  });

  it("ne demande rien au serveur sur un pseudo inchangé", () => {
    expect(doitVerifierLaDisponibilite("valentine", PROFIL)).toBe(false);
  });

  /* Interroger une forme que le contrat refuse rendrait « libre » sur un
     pseudo qu'on ne pourra jamais enregistrer. */
  it("ne demande rien sur une forme irrecevable", () => {
    expect(doitVerifierLaDisponibilite("va", PROFIL)).toBe(false);
  });

  it("demande sur un pseudo neuf et bien formé", () => {
    expect(doitVerifierLaDisponibilite("valou", PROFIL)).toBe(true);
  });
});

describe("quand le bouton s'allume", () => {
  it("reste éteint sur un formulaire intact", () => {
    expect(peutEnregistrer(tel_quel(), PROFIL, null)).toBe(false);
  });

  it("s'allume sur un changement qui ne touche pas au pseudo", () => {
    expect(peutEnregistrer({ ...tel_quel(), genre: "male" }, PROFIL, null)).toBe(true);
  });

  /* Tant que la réponse n'est pas là, on attend : `null` n'est pas « libre ».
     Envoyer vers un refus perdrait aussi les autres changements du formulaire,
     puisque le corps part entier. */
  it("attend la réponse du serveur sur un pseudo neuf", () => {
    const saisie = { ...tel_quel(), pseudo: "valou" };
    expect(peutEnregistrer(saisie, PROFIL, null)).toBe(false);
    expect(peutEnregistrer(saisie, PROFIL, false)).toBe(false);
    expect(peutEnregistrer(saisie, PROFIL, true)).toBe(true);
  });

  // Un pseudo mal formé bloque tout : l'envoi partirait entier et serait
  // refusé entier, emportant le genre ou la langue qu'on venait de corriger.
  it("bloque sur un pseudo irrecevable, même si autre chose a changé", () => {
    expect(peutEnregistrer({ ...tel_quel(), pseudo: "va", genre: "female" }, PROFIL, true))
      .toBe(false);
  });
});
