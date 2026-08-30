import { describe, expect, it } from "vitest";
import type { ExternalIdentity, SessionSummary } from "@lehno/contracts";
import {
  appareils, autresAppareils, estCetAppareil, moyensDeConnexion, natureDeLAppareil,
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

/* La lignée que `session(1, …)` porte : on la nomme plutôt que de la recopier,
   pour qu'un changement du fabricant ne fasse pas passer le test à côté. */
const LIGNEE_1 = "00000001-0000-4000-8000-000000000000";

describe("« cet appareil »", () => {
  /* CE QUI ÉTAIT IMPOSSIBLE ET NE L'EST PLUS. La réponse de connexion ne
     rendait aucun identifiant de session ; elle rend maintenant `sessionId`,
     la LIGNÉE — celle-là même que `/me/sessions` porte comme `id`. */
  it("reconnaît la lignée d'où l'on regarde", () => {
    expect(estCetAppareil(session(1, "2026-08-30T10:00:00.000Z"), LIGNEE_1)).toBe(true);
    expect(estCetAppareil(session(2, "2026-08-29T10:00:00.000Z"), LIGNEE_1)).toBe(false);
  });

  /* SANS LIGNÉE CONNUE, ON NE COCHE RIEN. Une session ouverte par une version
     qui ne la gardait pas encore reste valide et n'en a pas. Cocher au hasard
     ferait révoquer la mauvaise en croyant garder la sienne — et deviner par le
     `User-Agent` tomberait sur la mauvaise dès qu'un téléphone a deux sessions
     ouvertes, qui portent le même. */
  it("ne coche rien plutôt que de deviner", () => {
    expect(estCetAppareil(session(1, "2026-08-30T10:00:00.000Z"), null)).toBe(false);
  });
});

describe("« déconnecter les autres appareils »", () => {
  /* LE LIBELLÉ DIT « LES AUTRES », et la route l'honore enfin : elle épargne la
     lignée appelante — le service nomme son paramètre `sauf`. Auparavant elle
     révoquait tout, celle qui appelle comprise : le bouton promettait de rester
     connecté ici, et déconnectait. */
  it("compte les autres, sans la nôtre", () => {
    expect(autresAppareils([session(1, "2026-08-30T10:00:00.000Z"), session(2, "2026-08-29T10:00:00.000Z")], LIGNEE_1)).toBe(1);
  });

  /* On ne retranche PAS un aveuglément : sans lignée connue, on ne sait pas si
     la nôtre est dans la liste, et `length - 1` annoncerait une session de
     moins qu'il n'y en a. */
  it("ne retranche rien quand la nôtre est inconnue", () => {
    expect(autresAppareils([session(1, "2026-08-30T10:00:00.000Z"), session(2, "2026-08-29T10:00:00.000Z")], null)).toBe(2);
  });

  /* Zéro : le bouton ne paraît pas. Un bouton qui ne fait rien, sur un écran
     qu'on ouvre par inquiétude, se presse quand même — et son silence se lit
     comme une panne plutôt que comme « il n'y avait rien à fermer ». */
  it("ne trouve personne d'autre quand on est seul", () => {
    expect(autresAppareils([session(1, "2026-08-30T10:00:00.000Z")], LIGNEE_1)).toBe(0);
  });
});
