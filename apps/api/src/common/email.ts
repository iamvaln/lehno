import domainesJetables from "disposable-email-domains";
import { AppError } from "./errors.js";

// Une adresse jetable n'est refusée nulle part en particulier : elle l'est
// partout. Ce fichier est le seul endroit où la règle s'écrit, pour qu'aucune
// surface ne s'en écarte par oubli — liste d'attente, code de connexion,
// réservation d'un souhait, dépôt d'un vœu.

// 121 570 domaines au chargement : un Set les rend interrogeables en temps
// constant, une seule fois pour la vie du processus.
const JETABLES: ReadonlySet<string> = new Set(domainesJetables as readonly string[]);

// Gmail ignore les points de la partie locale, et googlemail.com est le même
// service. Les autres fournisseurs, eux, distinguent « a.b@ » de « ab@ » :
// appliquer la règle partout fusionnerait des boîtes réellement distinctes.
const GMAIL = new Set(["gmail.com", "googlemail.com"]);

function decouper(email: string): { locale: string; domaine: string } | null {
  const arobase = email.lastIndexOf("@");
  if (arobase <= 0 || arobase === email.length - 1) return null;
  return { locale: email.slice(0, arobase), domaine: email.slice(arobase + 1) };
}

/**
 * La forme sous laquelle deux adresses désignent la même boîte.
 *
 * Sert au **décompte** — clés de limitation de débit, détection de doublon —
 * jamais à l'envoi : on écrit à l'adresse telle qu'elle a été saisie, c'est
 * celle que la personne reconnaîtra. La spécification technique (9.9) pose la
 * règle : « l'énumération d'une même boîte par suffixes (a+1@, a+2@) est
 * détectée : la partie qui suit le + est ignorée pour le décompte ».
 *
 * Le sous-adressage est ignoré chez tous les fournisseurs, pas seulement ceux
 * qui l'implémentent : chez ceux qui ne le font pas, « a+x@ » n'est de toute
 * façon pas une boîte qui reçoit. Le seul risque est que deux personnes d'un
 * même domaine partageant la partie avant le « + » partagent un compteur —
 * conséquence bien plus légère que l'énumération qu'on empêche.
 */
export function canonicalEmail(email: string): string {
  const bas = email.trim().toLowerCase();
  const parts = decouper(bas);
  if (!parts) return bas;

  const plus = parts.locale.indexOf("+");
  let locale = plus >= 0 ? parts.locale.slice(0, plus) : parts.locale;
  let domaine = parts.domaine;

  if (GMAIL.has(domaine)) {
    locale = locale.replaceAll(".", "");
    domaine = "gmail.com";
  }

  // Une partie locale devenue vide (« +tag@… ») ne doit pas produire une clé
  // « @domaine » que toutes les adresses de ce domaine partageraient.
  if (locale === "") return bas;

  return `${locale}@${domaine}`;
}

/** Le domaine figure-t-il dans la liste des fournisseurs jetables ? */
export function isDisposableEmail(email: string): boolean {
  const parts = decouper(email.trim().toLowerCase());
  return parts ? JETABLES.has(parts.domaine) : false;
}

/**
 * La garde à poser en tête de tout point d'entrée qui accepte une adresse.
 *
 * Le message reste le même pour la personne : son adresse n'est pas acceptée.
 * Le code, lui, dit pourquoi — c'est ce qui permet à une interface de proposer
 * autre chose plutôt que d'afficher une erreur muette.
 */
export function assertUsableEmail(email: string): void {
  if (isDisposableEmail(email)) {
    throw new AppError("email_disposable", "disposable email domain refused");
  }
}
