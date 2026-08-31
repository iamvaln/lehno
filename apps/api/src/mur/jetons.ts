import { randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { AppError } from "../common/errors.js";
import { RateLimitService } from "../common/rate-limit.service.js";

/* Les outils communs aux surfaces sans session.
 *
 * Elles n'ont ni compte, ni jeton de session, ni rien qui dise qui frappe : ce
 * fichier rassemble ce qui les protège quand même — un jeton qu'on ne devine
 * pas, et deux filtres à robots.
 */

// 26 caractères base32url tirés de 16 octets : 128 bits d'entropie dans une
// colonne varchar(32), et rien qui se prononce mal ou se recopie de travers.
// Le jeton VAUT permission : le dériver de l'identifiant, ou d'un compteur, le
// rendrait devinable — et une adresse devinable ouvre la fiche d'un inconnu.
export function nouveauJeton(): string {
  return randomBytes(16).toString("base64url").replace(/[-_]/g, "").slice(0, 26);
}

// Bornes de la soumission, identiques à celles de la liste d'attente. En deçà
// d'une seconde, personne n'a lu la page ni tapé quoi que ce soit. Au-delà
// d'un jour, la page traînait ouverte — ou l'instant a été inventé.
const DELAI_MINIMAL_MS = 1_000;
const DELAI_MAXIMAL_MS = 24 * 3_600_000;

// Plafonds des formulaires publics. Par JETON autant que par ORIGINE : borner
// la seule origine laisserait un lien partagé sur un réseau se faire arroser
// depuis mille adresses ; borner le seul jeton laisserait une même machine
// remplir tous les liens qu'elle trouve.
const PLAFOND_JETON = 20;
const PLAFOND_ORIGINE = 30;
const FENETRE_MS = 3_600_000;

type Soumission = { website?: string | undefined; renderedAt?: number | undefined };

@Injectable()
export class SurfacePubliqueService {
  private readonly journal = new Logger("surface-publique");

  // @Inject explicite : voir WaitlistService — sous vitest/esbuild,
  // design:paramtypes n'est pas émis, un paramètre typé sans jeton explicite
  // se résoudrait à `undefined` chez Nest.
  constructor(@Inject(RateLimitService) private readonly limiter: RateLimitService) {}

  /* Deux filtres à robots ORDINAIRES, l'un et l'autre franchissables par qui
   * s'en donne la peine — ce sont des économies de bruit, pas des remparts. Le
   * rempart, ce sont les plafonds ci-dessous et la validation du propriétaire,
   * qui ne dépendent d'aucune coopération du client.
   *
   * UN SEUL code ET un seul message : `AppError.toEnvelope` rend le message au
   * client tel quel, donc deux libellés distincts diraient au robot lequel des
   * deux filtres a mordu — et il s'ajusterait. La distinction n'existe que
   * dans le journal, où elle sert au diagnostic.
   */
  refuserLesRobots(input: Soumission): void {
    const refuser = (cause: string): never => {
      this.journal.warn(`soumission écartée : ${cause}`);
      throw new AppError("collect_rejected", "submission rejected");
    };

    if (input.website !== undefined && input.website !== "") refuser("champ leurre rempli");
    if (input.renderedAt !== undefined) {
      const ecoule = Date.now() - input.renderedAt;
      if (ecoule < DELAI_MINIMAL_MS || ecoule > DELAI_MAXIMAL_MS) {
        refuser(`délai de soumission invraisemblable (${ecoule} ms)`);
      }
    }
  }

  // `ip` vient de la connexion, jamais du corps : un client qui l'annoncerait
  // lui-même choisirait son propre plafond. Elle ne sert qu'à composer une clé
  // de limiteur — ni journalisée, ni renvoyée.
  async plafonner(portee: string, jeton: string, ip?: string): Promise<void> {
    await this.limiter.hit(`${portee}:token:${jeton}`, PLAFOND_JETON, FENETRE_MS);
    if (ip) await this.limiter.hit(`${portee}:ip:${ip}`, PLAFOND_ORIGINE, FENETRE_MS);
  }
}
