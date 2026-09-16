import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* LE BANDEAU DE L'ACCUEIL EST LE MÊME DANS LES TROIS ÉTATS.
 *
 * Les planches 3.2 le montrent identique au premier lancement, à vide et au
 * chargement : le logotype à gauche, la cloche à droite.
 *
 * Deux écarts avaient été livrés. Le logotype n'était nulle part, alors que
 * `Wordmark` existe au kit et sert déjà à la connexion et à la maintenance. Et
 * la branche du PREMIER LANCEMENT ne rendait aucun bandeau — ni logotype, ni
 * cloche.
 *
 * LA CLOCHE ABSENTE COÛTAIT PLUS QUE SON DESSIN : `/notifications` n'est poussé
 * de nulle part ailleurs dans l'application. Sur un compte neuf, les
 * notifications étaient donc inatteignables, quand la planche montre justement
 * une pastille à deux.
 *
 * La garde vérifie que le bandeau se compose UNE fois et se pose dans les états
 * — pas qu'il existe trois fois, ce qui le ferait diverger.
 */

const source = readFileSync(new URL("../app/(app)/accueil.tsx", import.meta.url), "utf8");

describe("le bandeau de l'accueil", () => {
  it("porte le logotype", () => {
    expect(source).toMatch(/<Wordmark\b/);
  });

  it("porte la cloche, qui est le seul chemin vers les notifications", () => {
    expect(source).toMatch(/<NotificationBell\b/);
    expect(source).toMatch(/\/\(app\)\/notifications/);
  });

  /* UNE SEULE FOIS. Recopié dans chaque branche, il divergerait à la première
     retouche — celle qu'on oublie restant en arrière sans que rien ne le dise.
     C'est exactement ce qui est arrivé à la cloche, présente dans un état et
     absente de l'autre. */
  it("se compose une seule fois", () => {
    expect(source.match(/<Wordmark\b/g)).toHaveLength(1);
    expect(source.match(/<NotificationBell\b/g)).toHaveLength(1);
  });

  /* ET IL SE POSE DANS L'ÉTAT DU PREMIER LANCEMENT, qui s'en passait. Cette
     branche rend tôt : sans le bandeau AVANT son `EmptyState`, elle repart sans
     rien en haut. */
  it("se pose aussi au premier lancement", () => {
    const branche = source.indexOf('if (etat === "premier")');
    expect(branche, "la branche du premier lancement a disparu").toBeGreaterThan(-1);
    const vide = source.indexOf("<EmptyState", branche);
    const pose = source.indexOf("{bandeau}", branche);
    expect(pose, "le premier lancement ne pose aucun bandeau").toBeGreaterThan(-1);
    expect(pose, "le bandeau y est posé APRÈS l'état vide").toBeLessThan(vide);
  });
});
