import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * THE TABS FOLDER HOLDS TABS, AND NOTHING ELSE.
 *
 * `app/(app)/_layout.tsx` mounts a `Tabs`, and `expo-router` registers as a tab
 * EVERY route in that layout's folder — declared or not. Twenty-four screens
 * were therefore tabs nobody asked for, invisible only because our `TabBar`
 * draws a fixed list of five.
 *
 * Two failures came out of it, both silent, both seen only on a device:
 *
 * - `back()` popped nothing. On a tab navigator it applies `backBehavior`,
 *   which defaults to `firstRoute` — so the back arrow always landed on the
 *   home tab, from Settings as from Me.
 * - a tab never unmounts, so none of those screens ever reset. Closing an
 *   account reopened at step three with its code already spent, and the only
 *   way to start over was to kill the app.
 *
 * NO TEST COULD SEE IT: the tab table was right, every screen was right — it
 * was their assembly that was not. That is why this guard reads the tree
 * instead of rendering anything, and why adding a screen back into `(app)/`
 * must fail here rather than on someone's phone.
 */

const APP_DIR = new URL("../app/(app)/", import.meta.url);
const TABS = ["accueil", "dates", "moi", "proches", "reglages"];

const entries = readdirSync(APP_DIR, { withFileTypes: true });

describe("the tabs folder", () => {
  it("holds one folder per tab, and no loose screen", () => {
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    expect(files).toEqual(["_layout.tsx"]);
  });

  it("holds exactly the five tabs", () => {
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    expect(dirs).toEqual([...TABS].sort());
  });

  /* A tab folder without its own `Stack` is the very bug this guard exists for:
     its screens would fall back to being siblings in the tab navigator, and
     `back()` would return to the first tab again. */
  it("gives every tab its own stack", () => {
    for (const tab of TABS) {
      const layout = readFileSync(new URL(`${tab}/_layout.tsx`, APP_DIR), "utf8");
      expect(layout, `${tab} has no Stack`).toMatch(/<Stack\b/);
    }
  });

  it("gives every tab an entry screen", () => {
    for (const tab of TABS) {
      const inside = readdirSync(new URL(`${tab}/`, APP_DIR));
      expect(inside, `${tab} has no index.tsx`).toContain("index.tsx");
    }
  });

  /* §7 of the test log: opening a person's card, sharing a link, coming back
   * — the Proches tab reopened on the card rather than the list, because
   * `navigate` restores whatever its stack was left on. Decided: the tab
   * shows the list. `popToTopOnBlur` resets that one stack on every tab
   * switch away from it; the other four keep their default behavior. */
  it("resets Proches to its list when the tab loses focus", () => {
    const layout = readFileSync(new URL("_layout.tsx", APP_DIR), "utf8");
    expect(layout).toMatch(/name="proches"\s+options=\{\{\s*popToTopOnBlur:\s*true\s*\}\}/);
  });
});
