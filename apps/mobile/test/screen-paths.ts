/**
 * Where a screen file lives, from its route name.
 *
 * WHY THIS EXISTS AT ALL. Screens used to sit side by side in `app/(app)/`, so
 * a test could build a path by concatenation — `app/(app)/${name}.tsx`. That
 * flatness was the bug: `expo-router` registers everything in a `Tabs` folder
 * as a tab, so twenty-four screens were tabs nobody asked for. `back()` then
 * applied `backBehavior` — `firstRoute` by default — and always returned to
 * the home tab; and a tab never unmounts, so none of those screens ever reset.
 *
 * Splitting them fixed the app and broke every test that guessed a path. This
 * table is the one place that knows where a screen now lives, so the next move
 * costs one edit rather than a sweep across the suite.
 *
 * THREE HOMES, and the rule that puts a screen in one of them:
 *
 * - `app/(app)/<tab>/index.tsx` — the five tabs themselves.
 * - `app/(app)/<tab>/<name>.tsx` — reachable from ONE tab only, so it keeps the
 *   tab bar and lights the right tab.
 * - `app/<name>.tsx` — reachable from SEVERAL tabs, so it stacks above them.
 *   `recharge` is opened from seven places across four tabs; no single tab owns
 *   it, and the bar already showed nothing selected there.
 */

/** The five tabs. Their screen is `index.tsx` inside their own folder. */
const TABS = ["accueil", "dates", "moi", "proches", "reglages"] as const;

/** Reachable from one tab only — filed under it, tab bar kept. */
const OWNED_BY_TAB: Record<string, string> = {
  notifications: "accueil",
  monmur: "moi",
  apercu: "moi",
  parrainage: "moi",
  reservations: "moi",
  aide: "reglages",
  donnees: "reglages",
  fermeture: "reglages",
  paiement: "reglages",
  rappels: "reglages",
  securite: "reglages",
  collecte: "proches",
  "[id]": "proches",
  identite: "proches",
  recherche: "proches",
};

/**
 * The path of a screen, relative to `apps/mobile/`.
 *
 * Anything this table does not name sits at the root stack — that is the
 * default on purpose: a screen nobody filed under a tab belongs above them.
 */
export function screenPath(name: string): string {
  if ((TABS as readonly string[]).includes(name)) return `app/(app)/${name}/index.tsx`;
  const tab = OWNED_BY_TAB[name];
  if (tab) return `app/(app)/${tab}/${name}.tsx`;
  return `app/${name}.tsx`;
}
