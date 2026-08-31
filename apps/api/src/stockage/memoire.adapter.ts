import { cle as fabriquerCle, extensionDe } from "./cle.js";
import type { Depot, Prefixe, StockagePort } from "./stockage.port.js";

/* Le stockage en mémoire, pour les tests et le développement sans compartiment.
 *
 * Même rôle que `ConsoleTrackingAdapter` et l'envoi de courrier en console :
 * mille cinq cents tests ne peuvent pas dépendre d'un service distant, et un
 * développeur sans clés doit pouvoir faire tourner l'application.
 *
 * Il rend de VRAIES clés, de la même forme que l'adaptateur réel : un test qui
 * passerait ici et casserait là-bas parce que la clé n'a pas la même tête ne
 * prouverait rien.
 */
export class StockageMemoire implements StockagePort {
  private readonly contenu = new Map<string, Buffer>();

  deposer(prefixe: Prefixe, typeMime: string): Promise<Depot> {
    const c = fabriquerCle(prefixe, extensionDe(typeMime));
    return Promise.resolve({ cle: c, url: `memoire://depot/${c}`, expireDans: 600 });
  }

  lire(cle: string): Promise<string> {
    return Promise.resolve(`memoire://lecture/${cle}`);
  }

  ecrire(prefixe: Prefixe, contenu: Buffer, typeMime: string): Promise<string> {
    const c = fabriquerCle(prefixe, extensionDe(typeMime));
    this.contenu.set(c, contenu);
    return Promise.resolve(c);
  }

  effacer(cle: string): Promise<void> {
    this.contenu.delete(cle);
    return Promise.resolve();
  }

  /** Pour les tests seulement : ce qui a été rangé. */
  contenuDe(cle: string): Buffer | undefined {
    return this.contenu.get(cle);
  }
}
