/**
 * The gentler of the two version gestures — §4, phase 3.
 *
 * The server sets two headers when a newer build exists WITHOUT the current one
 * being out of service. Nothing is refused, nothing fails: the call goes
 * through, and these ride along with its answer.
 *
 * This is the opposite of the 426, which arrives as a failure and takes the
 * whole screen (see `arret.ts`). Here there is nothing to interrupt, and the
 * spec is explicit: discreet, once per session at most.
 */

/** Reads one response header. `Headers.get` has exactly this shape. */
export type HeaderReader = (name: string) => string | null;

export interface UpdateSuggestion {
  /** The newer version, as the registry spells it. */
  version: string;
  /** Where to get it, or null when the registry knows no link. */
  url: string | null;
}

/* HTTPS ONLY, and it is the same guard `lienDuMagasin` applies to the refusal's
   payload. The link comes from an admin form — `javascript:` and `itms-apps:`
   are what a typo, or someone with a back-office seat, could put there. What we
   hand to `Linking.openURL` is never taken on trust. */
const STORE_SCHEME = "https://";

function trimmedOrNull(value: string | null): string | null {
  /* The server drops a header it cannot carry rather than failing the request,
     so absence is ordinary here — and so is a header trimmed to nothing by a
     proxy. Both mean the same: there is nothing to suggest. */
  const text = value === null ? "" : value.trim();
  return text === "" ? null : text;
}

/**
 * What the answer suggests, or null when it suggests nothing.
 *
 * THE TWO HEADERS ARE INDEPENDENTLY OPTIONAL, and that is the case worth
 * naming: a version without a link still deserves the banner — "a new version
 * exists" is worth knowing even when we cannot open the store. The reverse is
 * not true: a link with no version names nothing, so it is dropped.
 */
export function updateSuggestion(header: HeaderReader): UpdateSuggestion | null {
  const version = trimmedOrNull(header("x-app-update-available"));
  if (version === null) return null;
  const url = trimmedOrNull(header("x-app-update-url"));
  return { version, url: url !== null && url.startsWith(STORE_SCHEME) ? url : null };
}

/**
 * ONCE PER SESSION AT MOST, and the header repeats on EVERY call.
 *
 * Without this, the banner would reappear on the next screen the moment someone
 * dismissed it — the header is still there, it always is. Dismissing has to
 * mean something, and what it means is "not again this session".
 *
 * A session is the running app, not an account: the state lives in memory and
 * dies with the process. Keeping it on disk would mean someone who dismissed
 * the banner in March never hears about any version again.
 */
export function banner(
  suggestion: UpdateSuggestion | null,
  shownAlready: boolean,
): UpdateSuggestion | null {
  return shownAlready ? null : suggestion;
}
