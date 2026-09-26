import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { messages } from "../messages/index.js";
import { CHEMINS_TRADUITS, cheminDansLautreLangue, cheminSuppressionDeCompte } from "../lib/chemins.js";

/**
 * THE ACCOUNT DELETION PAGE.
 *
 * The app already closes an account. This page exists because a store
 * requires a URL that works WITHOUT the app, for the case the app cannot
 * serve: a phone lost, reset, or uninstalled before its owner thought of
 * their data. Google asks for it by name — "Delete account URL" — and an
 * app that offers account creation does not ship without one.
 *
 * So these are not decoration. Each one guards something the store checks,
 * and something a reader depends on.
 */
describe("the account deletion page", () => {
  const LANGUES = ["fr", "en"] as const;

  it("exists as a route in both languages", () => {
    for (const langue of LANGUES) {
      const chemin = CHEMINS_TRADUITS["suppressionDeCompte"]?.[langue];
      expect(chemin, langue).toBeTruthy();
      expect(existsSync(new URL(`../app/[locale]/${chemin}/page.tsx`, import.meta.url)), langue).toBe(true);
    }
  });

  /* THE PATH IS IN THE LANGUAGE OF THE PAGE, like the legal pages: a French
     word in the address bar of an English reader, and an English page indexed
     under a French URL. */
  it("carries a path in each language, and they differ", () => {
    expect(cheminSuppressionDeCompte("fr")).toBe("/fr/supprimer-mon-compte");
    expect(cheminSuppressionDeCompte("en")).toBe("/en/delete-my-account");
  });

  /* THE LANGUAGE SWITCH MUST FOLLOW. A naive prefix swap would send
     /fr/supprimer-mon-compte to /en/supprimer-mon-compte, which is a 404 —
     the very bug CHEMINS_LEGAUX was written to avoid, and this page would
     have walked straight back into it. */
  it("switches to the other language without landing on a 404", () => {
    expect(cheminDansLautreLangue("/fr/supprimer-mon-compte", "fr")).toBe("/en/delete-my-account");
    expect(cheminDansLautreLangue("/en/delete-my-account", "en")).toBe("/fr/supprimer-mon-compte");
  });

  /* THE SECOND ROUTE IS THE WHOLE POINT. A page that only says "open the
     app" fails the requirement it was written for, and a store reviewer
     reads it. The address must be reachable and must be a real one. */
  it("offers a way that needs no app, with an address to write to", () => {
    for (const langue of LANGUES) {
      const voies = messages(langue).suppressionVoies;
      expect(voies, langue).toHaveLength(2);
      const adresses = voies.map((v) => v.adresse).filter(Boolean);
      expect(adresses, langue).toEqual(["contact@lehno.io"]);
    }
  });

  /* IT SAYS WHAT SURVIVES. "Everything is erased" is either false or
     unverifiable: accounting records outlive an account because the law
     requires them to. Saying so is the only honest version — and a deletion
     page that claims total erasure is a promise the nightly job does not
     keep. */
  it("names what is deleted and what is kept, in both languages", () => {
    for (const langue of LANGUES) {
      const effets = messages(langue).suppressionEffets;
      expect(effets.length, langue).toBeGreaterThanOrEqual(4);
      expect(effets.every((e) => e.titre.length > 0 && e.texte.length > 0), langue).toBe(true);
    }
  });

  /* THE THIRTY DAYS ARE THE ONE FIGURE A READER ACTS ON — it is how long
     they have to come back. `DELAI_DE_GRACE_DEFAUT` in the API says thirty;
     a page saying otherwise would promise a window the nightly job does not
     honour. */
  it("states the same grace period the API applies", () => {
    expect(messages("fr").suppressionEffets.some((e) => e.texte.includes("trente jours"))).toBe(true);
    expect(messages("en").suppressionEffets.some((e) => e.texte.includes("thirty days"))).toBe(true);
  });

  /* THE FAQ IS HOW ANYONE FINDS THIS PAGE. Without the link it exists only
     for whoever already has its address — which is the store, and nobody
     else. */
  it("is reachable from the FAQ in both languages", () => {
    for (const langue of LANGUES) {
      const items = messages(langue).faq.groupes.flatMap((g) => g.items);
      const avecLien = items.filter((i): i is typeof i & { lien: { href: string } } => "lien" in i && Boolean(i.lien));
      expect(avecLien.map((i) => i.lien.href), langue).toContain(cheminSuppressionDeCompte(langue));
    }
  });
});
