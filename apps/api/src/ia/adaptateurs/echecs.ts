import { PanneFournisseur, RefusModele } from "../routeur.service.js";

/* La traduction d'un échec HTTP en l'une des deux natures du routeur.
 *
 * Elle est PARTAGÉE parce que se tromper ici coûte cher dans les deux sens :
 * ranger une panne en refus prive du repli alors qu'un autre fournisseur aurait
 * répondu ; ranger un refus en panne fait payer le même non à chaque rang de la
 * chaîne. Une seule table, éprouvée une fois. */
export function traduire(statut: number, corps: string): Error {
  /* 429 est une PANNE, pas un refus. Le fournisseur dit « pas maintenant »,
     et un autre fournisseur, lui, dira oui — c'est exactement le cas où le
     repli sert à quelque chose. */
  if (statut === 429) return new PanneFournisseur("rate_limited");

  /* 401 et 403 : la clé est mauvaise ou n'a pas les droits. Ce n'est pas une
     panne au sens propre, et pourtant on la traite comme telle — parce que le
     bon geste est le même : replier sur un autre fournisseur, puis cesser de
     frapper à la porte. Le motif consigné dit « auth », donc l'administration
     lit la vraie cause au lieu de chercher un incident chez le fournisseur. */
  if (statut === 401 || statut === 403) return new PanneFournisseur("auth");

  if (statut >= 500) return new PanneFournisseur(String(statut));

  /* Le compte n'a plus de solde, ou a atteint son plafond de dépense.
   *
   * ÉPROUVÉ EN VRAI, et c'est ce qui a révélé le piège : DeepSeek le dit en
   * 402, OpenAI en 400 avec « billing hard limit ». Le 400 serait tombé dans le
   * refus juste en dessous — donc SANS repli, alors qu'un compte à sec est
   * exactement le cas où un autre fournisseur doit prendre le relais.
   *
   * Le motif dit « billing » plutôt que le statut : l'administration lit qu'il
   * faut recharger, au lieu de chercher un incident chez le fournisseur. */
  if (statut === 402 || corps.toLowerCase().includes("billing"))
    return new PanneFournisseur("billing");

  /* 400 recouvre les deux : une requête mal formée de notre côté, et un refus
     du modèle. On regarde ce que le corps nomme. Dans le doute, on choisit le
     REFUS — c'est-à-dire on ne replie pas : mieux vaut un non rendu une fois
     qu'un non payé trois fois. Une requête mal formée par nous se répéterait
     de toute façon à l'identique sur le rang suivant. */
  if (statut === 400 || statut === 422) {
    const b = corps.toLowerCase();
    const motif = ["content_policy", "safety", "policy", "moderation", "refus"]
      .find((m) => b.includes(m));
    return new RefusModele(motif ?? "invalid_request");
  }

  return new PanneFournisseur(String(statut));
}

/* Un échec RÉSEAU — connexion refusée, DNS, délai dépassé. Le fournisseur n'a
   rien dit du tout, ce qui est la définition même d'une panne. */
export function traduireReseau(err: unknown): Error {
  const nom = err instanceof Error ? err.name : "";
  // AbortSignal.timeout lève une TimeoutError ; certains runtimes rendent
  // encore AbortError. Les deux veulent dire la même chose ici, et le routeur
  // les range en `timeout` plutôt qu'en `error` — un délai dépassé se
  // diagnostique autrement qu'un 502.
  if (nom === "TimeoutError" || nom === "AbortError") return new PanneFournisseur("timeout");
  return new PanneFournisseur("network");
}

// Assez pour lire la nature de l'échec, jamais assez pour emporter le contenu
// de la demande — un corps d'erreur peut recopier l'invite, qui parle d'un
// proche de l'utilisateur.
export const EXTRAIT = 300;
