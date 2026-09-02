/* La forme attendue, décrite par ce qu'on en fait — pas par `ZodType`.
 *
 * `zod` n'est pas une dépendance de l'application web : elle consomme les
 * schémas depuis `@lehno/contracts`, qui la porte. L'importer ici pour un seul
 * type l'ajouterait au paquet servi au navigateur. Cette forme structurelle
 * accepte n'importe quel schéma Zod sans rien exiger de plus. */
type Analyseur<T> = { safeParse(valeur: unknown): { success: true; data: T } | { success: false } };

/**
 * Ce qu'on sait d'une surface publique, et ce qu'on n'en sait pas.
 *
 * **Quatre issues, et aucune n'est de trop.**
 *
 * « Inconnu » et « indisponible » ne se confondent pas : la première dit que la
 * ressource n'existe pas — c'est une information —, la seconde que nous n'avons
 * pas pu répondre. Rendre la 404 du site sur une panne dirait à un visiteur que
 * son amie n'a pas de Mur, ce qui est faux, et définitif pour lui.
 *
 * « Retiré » ne se confond avec ni l'un ni l'autre, et c'est le serveur qui l'a
 * décidé : un lien de collecte ou de vœux révoqué rend **410**, seul de tout le
 * contrat (`common/errors.ts`). Le visiteur l'a reçu de quelqu'un ; un 404 lui
 * ferait croire qu'il a mal recopié l'adresse, et « nous n'avons pas pu
 * répondre » l'enverrait réessayer une chose qui ne marchera jamais.
 *
 * « En intervention » non plus, et c'est la cinquième : pendant un arrêt le
 * serveur rend **503** sur tout, et le contrat le dit sans détour — « un arrêt
 * de deux heures se lirait comme une suppression définitive ». Le ranger en
 * panne enverrait le visiteur réessayer toutes les deux minutes une chose dont
 * on connaît l'heure de retour.
 */
export type Etat<T> =
  | { etat: "trouve"; donnees: T }
  | { etat: "inconnu" }
  | { etat: "retire" }
  /** `retour` est l'heure annoncée, ISO 8601 — nulle quand on ne la connaît
   *  pas. Pas de « bientôt », pas d'estimation inventée. */
  | { etat: "intervention"; retour: string | null }
  | { etat: "indisponible" };

/**
 * Charger une ressource publique, sans session, en rendant un état plutôt
 * qu'en levant.
 *
 * Toutes les surfaces publiques lisent la même sorte de chemin — un jeton ou un
 * pseudo dans l'adresse, aucune permission à porter — et **doivent traiter la
 * panne exactement pareil**. Un chargeur par surface, c'est trois `catch` qui
 * divergent le jour où l'un d'eux oublie de distinguer 404 et 502.
 *
 * `chemin` est déjà échappé par l'appelant : lui seul sait quel segment est une
 * donnée d'utilisateur.
 */
/* L'heure de retour annoncée, ou rien.
 *
 * `until` est FACULTATIVE : on ne la connaît pas toujours. Elle ne se déduit pas
 * de `retryAfterSeconds`, qui est le rythme de réessai — « un rythme de quinze
 * minutes ne dit pas que le service revient dans quinze minutes ».
 *
 * Un échec ici ne fait pas échouer la page : elle dira qu'une intervention est
 * en cours, sans l'heure. C'est le second des deux états que le contrat prévoit. */
async function heureDeRetour(base: string): Promise<string | null> {
  try {
    const reponse = await fetch(`${base}/v1/public/maintenance`, { cache: "no-store" });
    if (!reponse.ok) return null;
    const corps = await reponse.json() as { until?: unknown };
    return typeof corps?.until === "string" ? corps.until : null;
  } catch {
    return null;
  }
}

export async function chargerSurface<T>(
  chemin: string,
  forme: Analyseur<T>,
  revalidate: number,
): Promise<Etat<T>> {
  const base = process.env["API_URL"];
  // Sans adresse d'API on ne peut rien affirmer — surtout pas que la ressource
  // n'existe pas.
  if (!base) return { etat: "indisponible" };

  try {
    const reponse = await fetch(`${base}/v1${chemin}`, { next: { revalidate } });

    /* 404 vaut « cette ressource n'existe pas », et le serveur le rend AUSSI
       pour une ressource dépubliée, un lien révoqué ou un identifiant mal
       formé (§9.3 : jamais 403). La page n'a donc aucune règle à connaître —
       et surtout, elle ne peut pas dire qui a un compte. */
    if (reponse.status === 404) return { etat: "inconnu" };
    // 410 : le lien a existé et ne mène plus. Voir `Etat` ci-dessus.
    if (reponse.status === 410) return { etat: "retire" };
    /* 503 : le service est momentanément fermé, et `/public/maintenance` reste
       ouvert PENDANT l'arrêt — c'est même sa raison d'être. On y va tout de
       suite : sans l'heure de retour, la page ne saurait dire que « revenez »,
       ce qui est exactement le « bientôt » que le contrat interdit. */
    if (reponse.status === 503) return { etat: "intervention", retour: await heureDeRetour(base) };
    if (!reponse.ok) return { etat: "indisponible" };

    const analyse = forme.safeParse(await reponse.json());
    /* Une réponse valide mais d'une autre forme — un déploiement à moitié
       passé — n'est pas une ressource absente : on la dit indisponible plutôt
       que de rendre une page à trous. */
    return analyse.success ? { etat: "trouve", donnees: analyse.data } : { etat: "indisponible" };
  } catch {
    return { etat: "indisponible" };
  }
}
