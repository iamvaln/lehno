import { describe, expect, it } from "vitest";
import type { ReferralSummary } from "@lehno/contracts";
import { annonceUnGain, codePartageable, filleulsAboutis } from "../lib/parrainage.js";

const resume = (p: Partial<ReferralSummary> = {}): ReferralSummary => ({
  code: "VAL-4KX2", invited: [], creditsEarned: 0, bonusParInvitation: 2, ...p,
});

const invite = (status: "invited" | "registered" | "credited") =>
  ({ username: "ana", status, createdAt: "2026-01-01T00:00:00.000Z" });

describe("ce que le parrainage promet", () => {
  it("annonce le gain quand le serveur en rend un", () => {
    expect(annonceUnGain(resume())).toBe(true);
  });

  /* NUL VEUT DIRE « PLUS RIEN À PROMETTRE ». Le parrainage vit toujours —
     l'éteindre tuerait l'acquisition avec la monétisation — mais les crédits
     n'achètent plus rien. L'écran se présente alors sans chiffre. */
  it("se tait sur le gain quand le serveur ne rend rien", () => {
    expect(annonceUnGain(resume({ bonusParInvitation: null }))).toBe(false);
  });

  /* ON LIT LA VALEUR, JAMAIS LES DEUX DRAPEAUX. Croiser `referral` et
     `credits` soi-même referait le raisonnement du serveur, et s'en écarterait
     le jour où il change — c'est le défaut qui m'a coûté une feuille de
     paiement qui ne s'ouvrait jamais. */
  it("ne dépend d'aucune liste de drapeaux", () => {
    expect(annonceUnGain.length).toBe(1);
  });
});

describe("le code à partager", () => {
  /* LE HANDOFF LE DONNE EN DUR — « VAL-4KX2 ». Figé, tout le monde partagerait
     le même : les filleuls seraient rattachés à un compte qui n'est pas le
     leur, ou à aucun. Même faute que le numéro du compte de collecte. */
  it("vient du serveur", () => {
    expect(codePartageable(resume({ code: "ANA-9XZ1" }))).toBe("ANA-9XZ1");
  });

  it("n'offre pas de partager du vide", () => {
    expect(codePartageable(resume({ code: "" }))).toBeNull();
    expect(codePartageable(resume({ code: "   " }))).toBeNull();
  });
});

describe("le décompte des filleuls", () => {
  /* « Une personne a utilisé votre code » ne peut pas compter quelqu'un qui n'a
     fait que RECEVOIR l'invitation : la phrase promettrait un gain qui n'est
     pas venu, et le solde la démentirait. */
  it("ne compte pas ceux qui n'ont fait que recevoir l'invitation", () => {
    expect(filleulsAboutis(resume({ invited: [invite("invited")] }))).toBe(0);
  });

  it("compte les inscrits et les crédités", () => {
    expect(filleulsAboutis(resume({
      invited: [invite("invited"), invite("registered"), invite("credited")],
    }))).toBe(2);
  });

  it("rend zéro quand personne n'a été invité", () => {
    expect(filleulsAboutis(resume())).toBe(0);
  });
});
