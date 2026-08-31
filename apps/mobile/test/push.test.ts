import { describe, expect, it } from "vitest";
import {
  corpsDEnregistrement, doitEnregistrer, plateformeDeLAppareil, versionEnvoyable,
} from "../lib/push.js";

describe("la plateforme", () => {
  it("reconnaît les deux que le contrat accepte", () => {
    expect(plateformeDeLAppareil("ios")).toBe("ios");
    expect(plateformeDeLAppareil("android")).toBe("android");
  });

  /* `Platform.OS` peut rendre « web », « macos » ou « windows ». Les envoyer
     ferait échouer la validation serveur avec une erreur qui ne dirait pas
     pourquoi — et un appareil qui ne peut pas recevoir de notification n'a
     rien à faire dans la liste de ceux qui le peuvent. */
  it("refuse tout le reste plutôt que de l'envoyer au serveur", () => {
    for (const os of ["web", "macos", "windows", ""]) {
      expect(plateformeDeLAppareil(os)).toBeNull();
    }
  });
});

describe("la version envoyée", () => {
  it("part telle quelle quand elle tient", () => {
    expect(versionEnvoyable("1.2.3")).toBe("1.2.3");
    expect(versionEnvoyable("  1.2.3  ")).toBe("1.2.3");
  });

  /* UNE VERSION ABSENTE VAUT MIEUX QU'UNE VERSION TRONQUÉE. Le contrat borne à
     vingt caractères ; couper « 1.2.3-rc.4+build.20260831 » donnerait un numéro
     qui n'existe pas — et c'est sur ce numéro qu'on cherchera d'où vient un
     défaut. On omet plutôt que de mentir. */
  it("s'omet plutôt que de se tronquer", () => {
    expect(versionEnvoyable("1.2.3-rc.4+build.20260831")).toBeUndefined();
    expect(versionEnvoyable("")).toBeUndefined();
    expect(versionEnvoyable(null)).toBeUndefined();
    expect(versionEnvoyable(undefined)).toBeUndefined();
  });
});

describe("le corps envoyé au serveur", () => {
  /* On repasse par le schéma réel : un agencement inventé ici tiendrait
     pendant que le vrai tomberait. */
  it("compose ce que le contrat accepte", () => {
    expect(corpsDEnregistrement(" jeton-abcdefgh ", "ios", "1.2.3")).toEqual({
      pushToken: "jeton-abcdefgh", platform: "ios", appVersion: "1.2.3",
    });
  });

  it("omet la version quand elle ne tient pas", () => {
    expect(corpsDEnregistrement("jeton-abcdefgh", "android", null))
      .not.toHaveProperty("appVersion");
  });

  /* Le contrat exige huit caractères au moins : un jeton plus court est un
     jeton qu'on n'a pas encore reçu, pas un jeton court. Le laisser passer
     enregistrerait un appareil qui ne sonnera jamais. */
  it("refuse un jeton trop court plutôt que de l'enregistrer", () => {
    expect(() => corpsDEnregistrement("court", "ios", null)).toThrow();
  });
});

describe("quand enregistrer", () => {
  const vierge = { jetonEnregistre: null };

  /* PAS AVANT LA SESSION : la route est authentifiée. Un jeton envoyé sans
     compte rendrait 401 et serait perdu jusqu'au prochain démarrage. */
  it("n'envoie rien tant qu'il n'y a pas de session", () => {
    expect(doitEnregistrer(vierge, "jeton-abcdefgh", false)).toBe(false);
  });

  it("envoie au premier jeton reçu, une fois connecté", () => {
    expect(doitEnregistrer(vierge, "jeton-abcdefgh", true)).toBe(true);
  });

  /* LE CHANGEMENT DE JETON DOIT DÉCLENCHER UN NOUVEL ENVOI. C'est pourquoi on
     garde le jeton et non un booléen : une réinstallation produit un jeton
     neuf, et un booléen ne le verrait pas — le téléphone resterait silencieux
     sans qu'aucun écran ne le montre. */
  it("renvoie quand le jeton a changé", () => {
    expect(doitEnregistrer({ jetonEnregistre: "ancien-jeton" }, "nouveau-jeton", true)).toBe(true);
  });

  /* Mais pas à chaque retour au premier plan : ça ne casse rien — le serveur
     fait un upsert — mais ça consommerait du réseau à chaque déverrouillage. */
  it("ne renvoie pas le même jeton deux fois", () => {
    expect(doitEnregistrer({ jetonEnregistre: "jeton-abcdefgh" }, "jeton-abcdefgh", true)).toBe(false);
  });

  /* Pas de jeton : OneSignal ne l'a pas encore rendu, ou la permission a été
     refusée. Envoyer une chaîne vide ferait échouer la validation. */
  it("n'envoie rien sans jeton", () => {
    expect(doitEnregistrer(vierge, null, true)).toBe(false);
    expect(doitEnregistrer(vierge, "   ", true)).toBe(false);
  });
});
