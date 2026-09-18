/**
 * The address someone gives out so others can see their wall.
 *
 * It was written in the dictionary as `"lehno.io/" + pseudo`, and that was
 * wrong twice: it named PRODUCTION whatever build you were running — on the
 * sandbox a new account read an address belonging to someone else — and it left
 * out the `/m/` segment, so it pointed at nothing at all.
 *
 * THE SAME ADDRESS WAS RENDERED TWO WAYS in the same application: the wall
 * screen showed `publicUrl`, composed by the server and correct, while the
 * account screen two tabs away showed the hardcoded string.
 *
 * The base now comes from `/public/config`. The contract says why it cannot be
 * derived or hardcoded: "deriving it from the API's URL would work today and
 * break the day the two domains diverge; hardcoding it breaks on the sandbox,
 * where they ALREADY differ".
 *
 * THE `/m/` STAYS HERE, and that is deliberate: it is a route of the web site,
 * not a piece of configuration. Carried in the payload it would drift from
 * `mur.service.ts`, which composes the same path server-side, with nothing to
 * signal the divergence.
 */

/** Null when the base is not known yet — an address half-composed is a lie. */
export function wallAddress(siteUrl: string | null, username: string): string | null {
  const name = username.trim();
  if (siteUrl === null || name === "") return null;
  return `${siteUrl.replace(/\/+$/, "")}/m/${name}`;
}

/**
 * What the field shows under a pseudo being typed.
 *
 * The address is the hint; there is no sentence around it. While the base is
 * loading it shows NOTHING rather than a guess — the previous string was a
 * guess, and it was wrong.
 */
export function wallAddressHint(siteUrl: string | null, username: string): string | undefined {
  return wallAddress(siteUrl, username) ?? undefined;
}
