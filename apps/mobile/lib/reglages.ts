import { ecranEteint } from "./navigation.js";

/* Réglages — §3.28, et ce n'est pas un écran de plus : c'est celui SANS LEQUEL
 * on ne peut pas se déconnecter.
 *
 * « Moi » (3.17) n'est pas gouverné par un drapeau, c'est une conséquence : ses
 * quatre sections — le Mur, les listes, les mots reçus, les réservations — sont
 * toutes éteintes au lancement, donc l'onglet part. Sauf qu'il portait aussi ce
 * qui ne suit AUCUN drapeau : le solde, le profil, la sécurité, l'aide, et se
 * déconnecter. Tout cela partait avec lui.
 *
 * Réglages est le quatrième onglet du lancement — le dictionnaire le nomme
 * (`ongletReglages`), et les quatre sections ci-dessous sont les siennes.
 */

/* Les destinations que ce lot porte. `null` tant que l'écran n'existe pas : la
   ligne disparaît alors, comme les sorties de la fiche d'un proche. Un rang qui
   n'ouvre rien est pire qu'un rang absent — il apprend à ne pas croire les
   rangs. */
export type RouteDeReglage =
  | "/(app)/profil" | "/(app)/securite" | "/(app)/rappels" | "/(app)/donnees" | null;

export interface Rang {
  cle: string;
  icone: string;
  /* Le drapeau qui gouverne la ligne, ou `null` pour le socle. Le socle ne
     s'éteint jamais : profil, sécurité, aide et déconnexion ne sont pas des
     fonctionnalités qu'on allume. */
  drapeau: string | null;
  route: RouteDeReglage;
  /* Une ligne peut être un GESTE plutôt qu'une destination — se déconnecter
     n'ouvre pas d'écran. Sans ce marqueur, le filtre sur `route` la ferait
     disparaître avec celles qui n'existent pas encore. */
  geste?: "deconnexion";
  danger?: boolean;
}

export interface Section {
  cle: "argent" | "compte" | "alertes" | "aide";
  rangs: Rang[];
}

const PLAN: readonly { cle: Section["cle"]; rangs: readonly Rang[] }[] = [
  {
    cle: "argent",
    rangs: [
      { cle: "recharge", icone: "wallet", drapeau: null, route: null },
      // Le parrainage est OUVERT au lancement, mais son écran n'est pas porté.
      { cle: "parrainage", icone: "user-plus", drapeau: "referral", route: null },
      // Les méthodes enregistrées n'ont de sens qu'avec le paiement automatique.
      { cle: "paiement", icone: "credit-card", drapeau: "topup.provider", route: null },
    ],
  },
  {
    cle: "compte",
    rangs: [
      { cle: "profil", icone: "user", drapeau: null, route: "/(app)/profil" },
      { cle: "securite", icone: "shield", drapeau: null, route: "/(app)/securite" },
    ],
  },
  {
    cle: "alertes",
    rangs: [
      { cle: "rappels", icone: "bell", drapeau: null, route: "/(app)/rappels" },
      { cle: "donnees", icone: "database", drapeau: null, route: "/(app)/donnees" },
    ],
  },
  {
    cle: "aide",
    rangs: [
      { cle: "aide", icone: "circle-help", drapeau: null, route: null },
      /* SE DÉCONNECTER, et c'est aujourd'hui le seul rang qui fasse quelque
         chose. Un geste, pas une destination — d'où `geste`, sans quoi le
         filtre sur `route` l'emporterait avec les écrans à venir, et l'écran
         ne servirait plus à rien. */
      { cle: "deconnexion", icone: "log-out", drapeau: null, route: null, geste: "deconnexion", danger: true },
    ],
  },
];

/* Ce que l'écran montre, calculé — jamais une liste tenue à la main.
 *
 * Deux filtres, et ils ne disent pas la même chose. Le DRAPEAU retire ce que
 * le serveur a fermé ; on le lit par `ecranEteint`, qui porte déjà la règle de
 * chaque écran — la refaire ici donnerait deux vérités, et celle qui reste en
 * arrière ouvrirait un chemin vers un mur.
 *
 * La ROUTE retire ce qui n'est pas encore construit. C'est un état du portage,
 * pas du produit : chaque écran qui arrive n'a qu'à renseigner sa route.
 *
 * Une section dont il ne reste aucun rang DISPARAÎT, titre compris. Un titre
 * seul annoncerait un contenu qui ne vient pas.
 */
export function sectionsDeReglages(actives: readonly string[]): Section[] {
  return PLAN
    .map((s) => ({
      cle: s.cle,
      rangs: s.rangs.filter((r) =>
        (r.route !== null || r.geste !== undefined)
        && (r.drapeau === null || !ecranEteint(r.cle, actives))),
    }))
    .filter((s) => s.rangs.length > 0);
}

/* Le corps de la déconnexion.
 *
 * On révoque la LIGNÉE au serveur avant d'effacer le trousseau : dans l'autre
 * ordre, un échec réseau laisserait un jeton de rafraîchissement valide dans la
 * nature sans qu'on puisse encore le nommer. Le contrat le prend dans le corps,
 * pas dans l'en-tête — le jeton d'accès dit QUI, celui-ci dit LAQUELLE.
 *
 * Sans jeton, il n'y a rien à révoquer et rien n'est appelé : c'est le cas
 * d'une session déjà morte, et il ne doit pas empêcher de sortir. */
export function corpsDeDeconnexion(
  rafraichissement: string | null,
): { chemin: string; corps: { refreshToken: string } } | null {
  if (!rafraichissement) return null;
  return { chemin: "/auth/session", corps: { refreshToken: rafraichissement } };
}
