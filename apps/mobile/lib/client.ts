import type { Platform as PlatformType } from "react-native";

/* The six headers every call carries, so the server knows which build is
 * talking to it.
 *
 * WHY THEY LIVE HERE AND NOT IN `api.ts`: this module holds the decision — what
 * each header says and when it is omitted — while `api.ts` only knows how to
 * send. The decision is the part that needs proving, and proving it must not
 * require a network stack.
 *
 * THIS FILE IS IN ENGLISH, and it is the first one. `CLAUDE.md` now asks that
 * every NEW file be written entirely in English; existing files keep the
 * language they carry until the normalisation pass. A file is one language or
 * the other, never a mixture.
 */

/* WHAT EXPO PUTS IN `extra` IS NOT WHAT YOU WROTE THERE.
 *
 * `app.config.js` sets these to `null` when the build variable is absent. The
 * resolved config turns that `null` into `{}` — an EMPTY OBJECT — and `??` does
 * not catch it, because `??` only catches `null` and `undefined`.
 *
 * The header then travelled with an object for a value, and Expo's `fetch`
 * refused the WHOLE request: "Cannot cast … for field 'headers' of type
 * Array<Array<String>>". Not the header — the request. Every call in the app
 * failed, and the screen said "the connection did not go through", which sent
 * everyone looking at the network.
 *
 * So we never trust the shape of what comes back from the config: a value is a
 * string or it does not exist. A cast would have been a lie, and it was. */
export function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** What the build knows about itself. Every field may be missing in development. */
export interface BuildIdentity {
  /** The client credentials, baked in at build time. Absent in a local run. */
  clientId: string | null;
  clientKey: string | null;
  /** `expo.version` — what a human reads, e.g. `0.1.0`. */
  version: string | null;
  /** The native build number — what compares. Absent outside a store build. */
  build: string | null;
  /** `ios` | `android`, and the OS version as the platform reports it. */
  os: PlatformType["OS"];
  osVersion: string | number;
  /** `prod` | `staging` | `dev`. */
  env: string;
}

/* LOWERCASE, AND THE CONTRACT DECIDES. The server normalises case today, but
   the contract declares `mobile_ios`: relying on a tolerance is betting it will
   never change. Anything that is not iOS or Android is reported as-is rather
   than guessed — a wrong platform would be refused on every device at once, and
   no test would have caught it. */
export function clientType(os: PlatformType["OS"]): string {
  return `mobile_${os}`;
}

/* `<os>:<version>`, and the version is stringified because Android reports an
   API LEVEL as a number — `34`, not `14`. The server stores it as it arrives;
   converting it here would mean keeping a lookup table in the client, which
   would go stale silently. The spec carries the note instead. */
export function osHeader(os: PlatformType["OS"], version: string | number): string {
  return `${os}:${String(version)}`;
}

/* WHAT IS UNKNOWN IS NOT SENT.
 *
 * A header carrying an empty string claims a value that does not exist, and the
 * server cannot tell it apart from a build that lied. Omitting it is honest, and
 * it is what the registry already expects: "a call without x-app-build cannot be
 * compared".
 *
 * This matters most in development, where there is NO native build number —
 * `appVersionSource` is `remote`, so the number only exists in binaries EAS
 * produced. Expo Go and internal builds have none.
 */
export function clientHeaders(identity: BuildIdentity): Record<string, string> {
  /* LA DERNIÈRE GARDE, et elle a déjà servi. Même avec `textOrNull` en amont,
   * cette fonction refuse ce qui n'est pas une chaîne : elle construit les
   * en-têtes, donc c'est ici que le coût d'une valeur mal typée se paie — et il
   * se paie sur la requête ENTIÈRE, pas sur l'en-tête fautif. */
  const texte = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
  const id = texte(identity.clientId);
  const key = texte(identity.clientKey);
  const version = texte(identity.version);
  const build = texte(identity.build);
  return {
    ...(id === null ? {} : { "x-client-id": id }),
    ...(key === null ? {} : { "x-client-key": key }),
    "x-client-type": clientType(identity.os),
    ...(version === null ? {} : { "x-app-version": version }),
    ...(build === null ? {} : { "x-app-build": build }),
    "x-app-os": osHeader(identity.os, identity.osVersion),
    "x-app-env": texte(identity.env) ?? "dev",
  };
}
