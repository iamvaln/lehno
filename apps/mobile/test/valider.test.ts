import { describe, expect, it } from "vitest";
import type { ReceivedWish } from "@lehno/contracts";
import { motsATrancher, resteATrancher, sortDuMot } from "../lib/valider.js";

const mot = (n: number, status: ReceivedWish["status"], quand: string): ReceivedWish => ({
  id: `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`,
  occurrenceId: "11111111-1111-4111-8111-111111111111",
  authorName: "Ana", content: "Bon anniversaire", status, createdAt: quand,
});

describe("le sort d'un mot reçu", () => {
  /* RETENIR N'EST PAS AFFICHER, et c'est la distinction que j'avais manquée.
     Épingler garderait un mot VISIBLE sur le Mur — ce qui n'existe pas, « le
     Mur n'a pas de livre d'or ». Retenir veut dire qu'on CONSIDÈRE ce qui est
     arrivé ; écarter, qu'on ne le considère pas — pas qu'on le cache. */
  it("nomme les trois sorts sans parler de visibilité", () => {
    expect(sortDuMot(mot(1, "approved", "2026-01-01T00:00:00.000Z"))).toBe("retenu");
    expect(sortDuMot(mot(2, "rejected", "2026-01-01T00:00:00.000Z"))).toBe("ecarte");
    expect(sortDuMot(mot(3, "pending", "2026-01-01T00:00:00.000Z"))).toBe("attend");
  });

  /* `pending` n'est pas un refus : c'est ce qui n'a pas encore été tranché. Le
     confondre avec « écarté » ferait disparaître du sas ce qui l'attend — et le
     sas ne servirait plus à rien. */
  it("ne confond pas l'attente avec le refus", () => {
    expect(sortDuMot(mot(1, "pending", "2026-01-01T00:00:00.000Z"))).not.toBe("ecarte");
  });
});

describe("l'ordre du sas", () => {
  it("met en tête ce qui attend une décision", () => {
    const liste = motsATrancher([
      mot(1, "approved", "2026-06-01T00:00:00.000Z"),
      mot(2, "pending", "2026-01-01T00:00:00.000Z"),
      mot(3, "rejected", "2026-05-01T00:00:00.000Z"),
    ]);
    expect(liste.map((m) => m.status)).toEqual(["pending", "approved", "rejected"]);
  });

  it("range le reste du plus récent au plus ancien", () => {
    const liste = motsATrancher([
      mot(1, "approved", "2026-01-01T00:00:00.000Z"),
      mot(2, "approved", "2026-06-01T00:00:00.000Z"),
    ]);
    expect(liste[0]?.createdAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("ne modifie pas la liste reçue", () => {
    const source = [
      mot(1, "approved", "2026-01-01T00:00:00.000Z"),
      mot(2, "pending", "2026-06-01T00:00:00.000Z"),
    ];
    motsATrancher(source);
    expect(source[0]?.status).toBe("approved");
  });
});

describe("ce qui reste à trancher", () => {
  /* Compter TOUT donnerait un nombre qui ne baisse jamais — et une file qu'on
     cesse d'ouvrir parce qu'elle annonce toujours la même chose. */
  it("ne compte que ce qui attend", () => {
    expect(resteATrancher([
      mot(1, "pending", "2026-01-01T00:00:00.000Z"),
      mot(2, "approved", "2026-01-01T00:00:00.000Z"),
      mot(3, "rejected", "2026-01-01T00:00:00.000Z"),
    ])).toBe(1);
  });

  it("rend zéro quand tout est traité", () => {
    expect(resteATrancher([mot(1, "approved", "2026-01-01T00:00:00.000Z")])).toBe(0);
    expect(resteATrancher([])).toBe(0);
  });
});
