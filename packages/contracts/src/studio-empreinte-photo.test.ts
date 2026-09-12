import { describe, expect, it } from "vitest";
import {
  matierePourEmpreintePortrait, reglagesPortraitDeDepart, type ReglagesPortrait,
} from "./studio.js";

/* CE QUE LE MODÈLE LIT DOIT BOUGER L'EMPREINTE — sans quoi on publie ce que
 * personne n'a vu.
 *
 * `photo.consigne` est littéralement dans l'invite : `portrait.service` la passe
 * à `inviteImagePortrait` dès que la voie est la photo. Hors de l'empreinte, on
 * la reformulait, la couverture d'essai de l'ancienne restait valable, et la
 * publication s'ouvrait sur une consigne jamais éprouvée.
 *
 * Les SEUILS sont le pendant : ils refusent une photo avant tout appel, le
 * modèle ne les voit jamais, et les compter ferait redemander un essai pour
 * vingt pixels — alors qu'on les règle au vu de ce qui arrive. */
describe("l'empreinte du portrait et la voie photo", () => {
  const avec = (f: (r: ReglagesPortrait) => void): ReglagesPortrait => {
    const r = reglagesPortraitDeDepart();
    f(r);
    return r;
  };

  it("bouge quand la consigne de la photo change", () => {
    const depart = reglagesPortraitDeDepart();
    expect(depart.photo).toBeDefined();

    const autre = avec((r) => { r.photo!.consigne.fr = "Inspire-toi du cadrage seulement."; });

    expect(matierePourEmpreintePortrait(autre))
      .not.toBe(matierePourEmpreintePortrait(depart));
  });

  it.each([
    ["coteMin", (r: ReglagesPortrait) => { r.photo!.coteMin = 512; }],
    ["luminositeMin", (r: ReglagesPortrait) => { r.photo!.luminositeMin = 40; }],
    ["nettetteMin", (r: ReglagesPortrait) => { r.photo!.nettetteMin = 12; }],
  ])("ne bouge pas quand %s change", (_nom, changer) => {
    expect(matierePourEmpreintePortrait(avec(changer)))
      .toBe(matierePourEmpreintePortrait(reglagesPortraitDeDepart()));
  });

  /* Le bloc est facultatif pour que les lignes déjà en base se relisent. Son
     absence doit donc valoir une empreinte, et non faire tomber le calcul. */
  it("se calcule encore quand le bloc manque", () => {
    const sans = reglagesPortraitDeDepart();
    delete sans.photo;
    expect(() => matierePourEmpreintePortrait(sans)).not.toThrow();
    expect(matierePourEmpreintePortrait(sans))
      .not.toBe(matierePourEmpreintePortrait(reglagesPortraitDeDepart()));
  });
});
