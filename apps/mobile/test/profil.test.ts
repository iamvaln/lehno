import { describe, expect, it } from "vitest";
import { updateProfileSchema, type Profile } from "@lehno/contracts";
import {
  corpsDeMiseAJour, doitVerifierLaDisponibilite, peutEnregistrer, pseudoPosable,
  pseudoRecevable, type SaisieDeProfil,
} from "../lib/profil.js";
import { ficheAChange } from "../lib/soi.js";

const PROFIL: Profile = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "valentine",
  displayName: "Valentine",
  avatarUrl: null,
  avatarKey: null,
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
  theme: PROFIL.theme,
});

describe("l'apparence", () => {
  /* « system » N'EST PAS un thème de plus : c'est la consigne de suivre
     l'appareil. Le contrat la porte, l'écran doit pouvoir la renvoyer — sans
     quoi personne ne peut REVENIR au suivi automatique après avoir figé un
     thème une fois, et le réglage devient un aller sans retour. */
  it("sait revenir au suivi de l'appareil", () => {
    const fige: Profile = { ...PROFIL, theme: "dark" };
    const corps = corpsDeMiseAJour({ ...tel_quel(), theme: "system" }, fige);
    expect(corps.theme).toBe("system");
    expect(updateProfileSchema.safeParse(corps).success).toBe(true);
  });

  it("n'envoie pas le thème quand il n'a pas bougé", () => {
    expect(corpsDeMiseAJour(tel_quel(), PROFIL)).not.toHaveProperty("theme");
  });
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
      { pseudo: "valou", nom: "Val", genre: "female", langue: "en", theme: "dark" }, PROFIL,
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

/* LE REFUS SE LIT À PART DU REPOS, parce qu'ils n'obéissent pas à la même
   règle. « Rien n'a changé » cède dès qu'un des deux objets de Mon profil bouge
   — le compte, ou la fiche de soi. « Le pseudo est irrecevable » ne cède devant
   rien.

   Les avoir mêlés a produit la faute que ce bloc tient : le jour où le bouton
   s'est ouvert à ce que la FICHE avait à dire, un pseudo mal formé a cessé de
   l'éteindre dès qu'une date de naissance était saisie. */
describe("le pseudo, qui ne cède devant rien", () => {
  it("passe sur un pseudo inchangé et bien formé", () => {
    expect(pseudoPosable(tel_quel(), PROFIL, null)).toBe(true);
  });

  it("refuse une forme que le contrat n'accepte pas", () => {
    expect(pseudoPosable({ ...tel_quel(), pseudo: "va" }, PROFIL, true)).toBe(false);
  });

  /* `null` = pas encore de réponse, et ce n'est pas « libre » : envoyer vers un
     refus emporterait les autres champs, puisque le corps part entier. */
  it("attend la réponse du serveur sur un pseudo neuf", () => {
    const neuf = { ...tel_quel(), pseudo: "valou" };
    expect(pseudoPosable(neuf, PROFIL, null)).toBe(false);
    expect(pseudoPosable(neuf, PROFIL, false)).toBe(false);
    expect(pseudoPosable(neuf, PROFIL, true)).toBe(true);
  });

  /* LE CAS QUI A ÉTÉ CASSÉ SANS QU'ON LE VOIE. La composition vit à l'écran —
     `profil.tsx`, l'attribut `disabled` du bouton — et ce test en tient la
     forme : si l'écran la change, cette ligne doit changer avec lui. Ce qu'elle
     retient est l'ORDRE : le refus d'abord, le repos ensuite. Sans le premier
     terme, la naissance saisie rallumait le bouton sur un pseudo mal formé, et
     l'appui partait vers un `PATCH` refusé qui n'écrivait ni le compte ni la
     fiche. */
  it("éteint le bouton sur un pseudo irrecevable, même quand la fiche a à dire", () => {
    const saisie: SaisieDeProfil = { ...tel_quel(), pseudo: "va", genre: "female" };
    const soi = {
      nom: "Valentine", nomDUsage: "", genre: "female" as const,
      naissance: { jour: 15, mois: 6, annee: 1994, anneeConnue: true },
    };
    // La fiche a bien quelque chose à dire : c'est ce qui rallumait le bouton.
    expect(ficheAChange(soi, null)).toBe(true);

    const eteint = !pseudoPosable(saisie, PROFIL, true)
      || (!peutEnregistrer(saisie, PROFIL, true) && !ficheAChange(soi, null));
    expect(eteint).toBe(true);
  });
});
