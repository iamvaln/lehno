import { describe, expect, it } from "vitest";
import type { ExternalIdentity, SessionSummary } from "@lehno/contracts";
import {
  appareils, estCetAppareil, moyensDeConnexion, natureDeLAppareil,
} from "../lib/securite.js";

const identite = (provider: ExternalIdentity["provider"]): ExternalIdentity => ({
  provider, linkedAt: "2026-01-01T00:00:00.000Z", lastUsedAt: null,
});

const session = (n: number, actif: string, ua: string | null = null): SessionSummary => ({
  id: `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastActiveAt: actif,
  userAgent: ua,
});

describe("par quoi on entre", () => {
  /* LE CODE N'EST PAS SERVI, et son absence veut dire « toujours là ».
     Il n'a pas de désactivation possible — c'est l'accès de secours —, donc le
     contrat ne lui donne pas de ligne. L'attendre du serveur ferait un écran
     qui n'affiche aucun moyen de connexion sur un compte qui en a un. */
  it("porte toujours la connexion par code, même sans rien de rattaché", () => {
    expect(moyensDeConnexion([])).toEqual([{ sorte: "code" }]);
  });

  // Les externes d'abord : on cherche ici ce qu'on a rattaché, pas ce qui ne
  // peut pas s'enlever.
  it("met les moyens rattachés avant le code", () => {
    const liste = moyensDeConnexion([identite("google")]);
    expect(liste.map((m) => m.sorte)).toEqual(["externe", "code"]);
  });
});

describe("depuis où l'on est entré", () => {
  /* `lastActiveAt` avance à chaque rotation : c'est la dernière fois que la
     lignée a servi. Trier par ouverture mettrait en tête une session morte
     depuis six mois — l'inverse de ce qu'on cherche quand on ouvre cet écran
     par inquiétude. */
  it("montre la plus récemment active d'abord", () => {
    const liste = appareils([
      session(1, "2026-01-02T00:00:00.000Z"),
      session(3, "2026-06-01T00:00:00.000Z"),
      session(2, "2026-03-01T00:00:00.000Z"),
    ]);
    expect(liste.map((s) => s.lastActiveAt)).toEqual([
      "2026-06-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z",
    ]);
  });

  it("ne modifie pas la liste reçue", () => {
    const source = [session(1, "2026-01-01T00:00:00.000Z"), session(2, "2026-06-01T00:00:00.000Z")];
    appareils(source);
    expect(source[0]?.lastActiveAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("l'icône d'un appareil", () => {
  it("reconnaît un téléphone", () => {
    expect(natureDeLAppareil("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
    expect(natureDeLAppareil("Dalvik/2.1.0 (Linux; U; Android 14)")).toBe("mobile");
  });

  it("reconnaît un ordinateur", () => {
    expect(natureDeLAppareil("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("ordinateur");
    expect(natureDeLAppareil("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("ordinateur");
  });

  /* L'en-tête est déclaré, jamais vérifié — « un indice, pas une preuve ».
     Une icône neutre vaut mieux qu'un téléphone dessiné pour un robot qui
     passait par là, ou pour un appareil qui n'a rien déclaré. */
  it("reste neutre plutôt que de deviner", () => {
    expect(natureDeLAppareil(null)).toBe("inconnu");
    expect(natureDeLAppareil("curl/8.4.0")).toBe("inconnu");
  });
});

describe("« cet appareil » ne se désigne pas", () => {
  /* LE MANQUE, TENU PAR UN TEST. La maquette coche la lignée courante ; ni le
     contrat ni le client ne peuvent la nommer — `/me/sessions` ne reçoit qu'un
     jeton d'accès qui ne dit pas de quelle lignée il descend, et la réponse de
     connexion ne rend aucun identifiant de session.

     Deviner par le `User-Agent` tomberait sur la mauvaise dès qu'un téléphone
     a deux sessions ouvertes : on garderait celle qu'on croyait fermer. */
  it("ne prétend jamais reconnaître la session courante", () => {
    expect(estCetAppareil()).toBe(false);
  });
});
