import { describe, expect, it } from "vitest";
import type { DataExportRequest } from "@lehno/contracts";
import { etatDeLExport, peutDemander } from "../lib/donnees.js";

const demande = (status: DataExportRequest["status"]): DataExportRequest => ({
  id: "11111111-1111-4111-8111-111111111111",
  status,
  requestedAt: "2026-08-01T10:00:00.000Z",
  completedAt: status === "ready" ? "2026-08-01T11:00:00.000Z" : null,
});

describe("l'état de la dernière demande", () => {
  /* `null` EST UNE RÉPONSE, pas une absence — le serveur rend d'ailleurs 200
     avec un corps nul plutôt qu'un 404, pour cette raison exacte. */
  it("traite « jamais demandé » comme un état", () => {
    expect(etatDeLExport(null)).toBe("aucune");
  });

  it("nomme chacun des quatre états du contrat", () => {
    expect(etatDeLExport(demande("pending"))).toBe("en_cours");
    expect(etatDeLExport(demande("ready"))).toBe("prete");
    expect(etatDeLExport(demande("failed"))).toBe("echouee");
    expect(etatDeLExport(demande("expired"))).toBe("expiree");
  });
});

describe("quand on peut redemander", () => {
  it("s'allume quand rien n'a jamais été demandé", () => {
    expect(peutDemander(null)).toBe(true);
  });

  /* Le serveur refuse la seconde demande par un `conflict` : « l'écran doit
     pouvoir dire *votre export est déjà en préparation* au lieu de laisser
     croire qu'il vient d'en relancer un ». Un bouton qui part pour revenir en
     erreur dit le contraire du refus qu'il reçoit. */
  it("s'éteint pendant la préparation", () => {
    expect(peutDemander(demande("pending"))).toBe(false);
  });

  /* Après un échec ou une expiration, c'est précisément là qu'on veut
     redemander. Et un export prêt se redemande aussi : le lien du courriel
     expire, et rien ne dit qu'on l'a encore. */
  it("se rallume après un échec, une expiration, ou même une réussite", () => {
    expect(peutDemander(demande("failed"))).toBe(true);
    expect(peutDemander(demande("expired"))).toBe(true);
    expect(peutDemander(demande("ready"))).toBe(true);
  });
});
