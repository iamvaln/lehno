import { describe, expect, it } from "vitest";
import {
  updateNotificationPreferencesSchema, type NotificationPreferenceItem,
} from "@lehno/contracts";
import {
  basculeDuGroupe, etatDuGroupe, groupesOfferts, plusRienNeParvient, RYTHMES,
  typesNonGroupes,
} from "../lib/rappels.js";

const LANCEMENT = ["collect", "referral", "topup.manual", "generation.message"];

const groupe = (cle: string, actives = LANCEMENT) => {
  const trouve = groupesOfferts(actives).find((g) => g.cle === cle);
  if (!trouve) throw new Error(`groupe « ${cle} » absent`);
  return trouve;
};

const pref = (
  type: NotificationPreferenceItem["type"], push: boolean, email: boolean,
): NotificationPreferenceItem => ({ type, pushEnabled: push, emailEnabled: email });

describe("le groupement", () => {
  /* LA GARDE QUI COMPTE. Le contrat peut ajouter une nature configurable ; si
     personne ne la groupe, elle devient invisible à l'écran — donc irréglable,
     donc allumée pour toujours sans que rien ne le dise. Ce test rougit le jour
     où une nature neuve arrive, et c'est tout ce qu'on lui demande. */
  it("ne laisse aucune nature configurable sans groupe", () => {
    expect(typesNonGroupes()).toEqual([]);
  });

  /* Régler la réception d'une contribution qu'on ne peut pas recevoir serait un
     interrupteur sans effet — et un interrupteur sans effet apprend à ne pas
     croire les interrupteurs. */
  it("retire le groupe dont le drapeau est éteint", () => {
    expect(groupesOfferts([]).map((g) => g.cle)).not.toContain("valider");
    expect(groupesOfferts(LANCEMENT).map((g) => g.cle)).toContain("valider");
  });

  /* J−7 ET J−1 NE FONT QU'UN. La maquette offre trois interrupteurs, le contrat
     n'a que deux natures : le délai se choisit par date au moment de la poser,
     pas globalement. Trois bascules dont deux commandent la même nature
     s'éteindraient ensemble sans qu'on comprenne pourquoi. */
  it("n'offre que deux réglages d'échéance, pas trois", () => {
    const cles = groupesOfferts(LANCEMENT).map((g) => g.cle);
    expect(cles).toContain("avant");
    expect(cles).toContain("jour");
    expect(cles.filter((c) => c === "avant" || c === "jour")).toHaveLength(2);
  });
});

describe("l'état d'un groupe", () => {
  /* Allumé seulement si TOUTES ses natures le sont. « Allumé dès qu'une l'est »
     montrerait une bascule active alors qu'une partie ne part pas — et c'est le
     silence qu'on ne pardonne pas : on croit être prévenu. */
  it("s'éteint dès qu'une de ses natures est éteinte", () => {
    const g = groupe("valider");
    expect(etatDuGroupe(g, [
      pref("contribution_received", true, true), pref("wish_received", true, true),
    ], "push")).toBe(true);
    expect(etatDuGroupe(g, [
      pref("contribution_received", true, true), pref("wish_received", false, true),
    ], "push")).toBe(false);
  });

  /* Une nature absente vaut son défaut, qui est ALLUMÉ. Une réponse tronquée ne
     doit pas se lire « éteint » : on croirait avoir coupé ce qui part encore. */
  it("lit une nature absente comme allumée", () => {
    expect(etatDuGroupe(groupe("avant"), [], "push")).toBe(true);
  });

  it("distingue les deux canaux", () => {
    const g = groupe("jour");
    const p = [pref("event_day_of", false, true)];
    expect(etatDuGroupe(g, p, "push")).toBe(false);
    expect(etatDuGroupe(g, p, "email")).toBe(true);
  });
});

describe("ce qu'on envoie pour basculer", () => {
  /* L'AUTRE CANAL RESTE INCHANGÉ. Le schéma d'une préférence porte les deux :
     omettre celui qu'on ne touche pas l'écraserait à son défaut, et couper la
     poussée rallumerait le courriel qu'on venait d'éteindre. */
  it("n'emporte pas l'autre canal", () => {
    const envoi = basculeDuGroupe(
      groupe("jour"), [pref("event_day_of", true, false)], "push", false,
    );
    expect(envoi).toEqual([{ type: "event_day_of", pushEnabled: false, emailEnabled: false }]);
  });

  /* Seules les natures du groupe partent : le contrat accepte une liste
     partielle, et renvoyer les onze écraserait ce qu'un autre appareil vient de
     changer. */
  it("n'envoie que les natures du groupe touché", () => {
    const envoi = basculeDuGroupe(groupe("valider"), [], "email", false);
    expect(envoi.map((p) => p.type)).toEqual(["contribution_received", "wish_received"]);
  });

  // Le corps repasse dans le schéma RÉEL : c'est lui qui décide.
  it("compose un corps que le contrat accepte", () => {
    const preferences = basculeDuGroupe(groupe("vie"), [], "push", false);
    expect(updateNotificationPreferencesSchema.safeParse({ preferences }).success).toBe(true);
  });
});

describe("l'avertissement du silence", () => {
  const tout = (push: boolean, email: boolean): NotificationPreferenceItem[] =>
    groupesOfferts(LANCEMENT).flatMap((g) => g.types.map((t) => pref(t, push, email)));

  it("se tait quand quelque chose parvient encore", () => {
    expect(plusRienNeParvient(groupesOfferts(LANCEMENT), tout(true, true))).toBe(false);
  });

  /* Fermer la poussée en gardant le courriel est un réglage ORDINAIRE, pas un
     silence. L'annoncer alarmerait pour rien — et l'avertissement cesserait
     d'être lu le jour où il compte. */
  it("se tait quand un seul canal reste ouvert", () => {
    expect(plusRienNeParvient(groupesOfferts(LANCEMENT), tout(false, true))).toBe(false);
  });

  it("parle quand les deux canaux sont fermés partout", () => {
    expect(plusRienNeParvient(groupesOfferts(LANCEMENT), tout(false, false))).toBe(true);
  });
});

describe("le rythme du récapitulatif", () => {
  /* `never` existe au contrat et n'a AUCUN libellé — l'inventer serait écrire
     à la place de qui écrit les textes. Ce n'est pas une perte : le
     récapitulatif est un groupe comme les autres, avec ses deux interrupteurs
     de canal, et les fermer le fait taire par le geste employé partout
     ailleurs. */
  it("n'offre que les rythmes qui ont un libellé", () => {
    expect(RYTHMES).toEqual(["weekly", "monthly"]);
  });

  // Et le silence reste atteignable, par les canaux du groupe.
  it("laisse le récapitulatif se taire par ses canaux", () => {
    const g = groupe("recap");
    expect(etatDuGroupe(g, [pref("digest", false, false)], "push")).toBe(false);
    expect(etatDuGroupe(g, [pref("digest", false, false)], "email")).toBe(false);
  });
});
