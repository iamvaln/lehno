import type { AdminRole } from "@lehno/contracts";

/**
 * Ce que chaque rôle voit, et dans quel ordre.
 *
 * Sorti de App.tsx pour une raison : ce fichier décide de ce qu'un support peut
 * atteindre. C'est une règle de droits, elle mérite de se lire et de se tester
 * seule — pas au milieu d'un composant de trois cents lignes.
 *
 * Le serveur refuse par ailleurs. Cacher une entrée n'est pas une protection,
 * c'est une politesse : on ne montre pas à quelqu'un des portes qu'il ne peut
 * pas ouvrir (ux-admin §6).
 */

export type Famille = "exploitation" | "economie" | "supervision" | "outils";

/**
 * Les leviers qui engagent le service et ses coûts. Fermés au support **y
 * compris en lecture** : un paramètre se lit vite et se retient, et le studio
 * dépense de l'argent réel à chaque essai.
 */
export const SECTIONS_ECONOMIE = [
  "parametres", "fonctionnalites", "modeles", "studio", "offres",
] as const;

/**
 * Réservées aux administrateurs sans appartenir à Économie. Le journal d'audit
 * porte le travail du support : le lui ouvrir lui retirerait sa valeur de
 * contrôle. Les accès vont avec — qui peut voir le journal peut voir qui le lit.
 */
const SECTIONS_ADMIN = ["audit", "acces"] as const;

const FERMEES_AU_SUPPORT = new Set<string>([...SECTIONS_ECONOMIE, ...SECTIONS_ADMIN]);

/**
 * L'ordre du back-office, tel que la spécification le fixe (ux-admin §5,
 * brief-maj-admin §1). Le tableau de bord se pose au-dessus, sans famille :
 * c'est l'accueil, pas une tâche.
 *
 * Quatre sections de l'outil ne figurent pas ici — alertes, suppressions,
 * messages de contact, liste d'attente. La spécification n'en fait pas des
 * sections : ce sont les files du « à traiter » du tableau de bord, qui y mène
 * déjà (§5.2). Elles restent donc atteignables, sans encombrer le menu.
 */
export const NAVIGATION: { famille: Famille | null; items: readonly string[] }[] = [
  { famille: null, items: ["tableau"] },
  // « assistance » ne porte pas de numéro dans la spécification, qui n'énumère
  // pas les quatre files parmi ses quatorze sections tout en confiant au
  // support « répondre aux utilisateurs et traiter les cas courants » (§6).
  // Elle se pose dans Exploitation, où vit son travail courant. Sans elle, les
  // quatre tables resteraient inatteignables : le « à traiter » du tableau de
  // bord ne mène qu'aux suppressions et aux connexions. À trancher.
  { famille: "exploitation", items: ["comptes", "credits", "assistance", "moderation"] },
  { famille: "economie", items: SECTIONS_ECONOMIE },
  // « acces » ne porte pas de numéro dans la spécification, qui ne l'énumère pas
  // parmi ses quatorze sections tout en réservant aux administrateurs le fait de
  // « gérer les accès des administrateurs » (§6). Il se pose ici, près du
  // journal d'audit, faute d'une place dite. À trancher.
  { famille: "supervision", items: ["metriques", "audit", "connexions", "acces"] },
  { famille: "outils", items: ["liens"] },
];

/** Les sections qu'un rôle peut atteindre, dans l'ordre du menu. */
export function sectionsVisibles(role: AdminRole): string[] {
  return NAVIGATION.flatMap(({ items }) =>
    items.filter((item) => role === "admin" || !FERMEES_AU_SUPPORT.has(item)),
  );
}

/**
 * Les familles à afficher pour ce rôle. Une famille vidée de toutes ses
 * sections **disparaît**, en-tête compris : un titre « Économie » suivi de rien
 * dirait à un support qu'il lui manque quelque chose.
 */
export function familles(role: AdminRole): { famille: Famille | null; items: string[] }[] {
  return NAVIGATION
    .map(({ famille, items }) => ({
      famille,
      items: items.filter((item) => role === "admin" || !FERMEES_AU_SUPPORT.has(item)),
    }))
    .filter(({ items }) => items.length > 0);
}

/** Une section hors des droits ramène au tableau de bord (ux-admin §5.1). */
export function sectionAutorisee(role: AdminRole, section: string): boolean {
  return role === "admin" || !FERMEES_AU_SUPPORT.has(section);
}
