import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DeroulementService } from "./deroulement.service.js";
import { ProgrammationService } from "./programmation.service.js";
import { RelancesService } from "./relances.service.js";
import { EnvoiService } from "./envoi.service.js";
import { GenerationService } from "./generation.service.js";

/* Le chef d'orchestre : ce qui déclenche, et dans quel ordre.
 *
 * L'ORDRE N'EST PAS ARBITRAIRE. Dérouler d'abord — sans échéances à venir, il
 * n'y a rien à programmer. Programmer ensuite. Relancer après, parce que la
 * relance par personne s'appuie sur les échéances qui viennent d'être ouvertes.
 * Envoyer en dernier, pour que ce qui vient d'être posé parte le jour même
 * plutôt que d'attendre vingt-quatre heures.
 *
 * Une étape qui tombe n'arrête pas les suivantes : elles ne dépendent pas de sa
 * RÉUSSITE, seulement de son passage. Un déroulement en panne laisse les
 * échéances d'hier, que la programmation traite quand même — mieux vaut des
 * rappels sur ce qui existe que rien du tout.
 */

// Tôt, avant que les gens n'ouvrent l'application, et à une heure creuse pour
// le courrielleur. L'heure d'envoi que chacun règle (§3.11) se respecte à
// l'ENVOI, pas ici : ce passage POSE la file, il ne décide pas de l'heure.
const CHAQUE_JOUR = "0 5 * * *";

/* LE RATTRAPAGE DES GÉNÉRATIONS A SA PROPRE CADENCE, et il la faut.
 *
 * Depuis que le lancement rend la main sans attendre la production, une
 * exécution abandonnée — un arrêt du serveur au mauvais moment — laisse un
 * crédit débité et un écran qui tourne. Au passage quotidien, quelqu'un dont la
 * génération échoue à neuf heures du matin attendrait son crédit jusqu'au
 * lendemain cinq heures. Vingt heures pour un remboursement, sur un geste payé.
 *
 * Toutes les dix minutes, donc. Le SEUIL, lui, ne bouge pas : une heure, parce
 * que trop court rembourserait une production qui allait aboutir — et on
 * écrirait alors deux fois le même message. Ce quart d'heure-là n'est pas un
 * réglage de confort, c'est la marge qui sépare « abandonnée » de « lente ».
 *
 * PAS DANS LE PASSAGE QUOTIDIEN : il y reste aussi, et c'est voulu. Les deux ne
 * se gênent pas — la garde de `rendreLeCredit` porte sur `pending`, donc un
 * remboursement déjà fait ne se refait pas. */
const CHAQUE_DIX_MINUTES = "*/10 * * * *";

@Injectable()
export class OrdonnanceurService {
  private readonly logger = new Logger("ordonnanceur");
  // Une exécution à la fois. Un passage qui déborde sur le suivant ferait
  // travailler deux processus sur la même file — inoffensif grâce aux clés
  // uniques, mais inutilement coûteux.
  private enCours = false;

  constructor(
    @Inject(DeroulementService) private readonly deroulement: DeroulementService,
    @Inject(ProgrammationService) private readonly programmation: ProgrammationService,
    @Inject(RelancesService) private readonly relances: RelancesService,
    @Inject(EnvoiService) private readonly envoi: EnvoiService,
    @Inject(GenerationService) private readonly generation: GenerationService,
  ) {}

  /* À PART DU PASSAGE QUOTIDIEN, et sans son verrou. Le verrou `enCours`
     protège une séquence de sept étapes qui dure ; ce rattrapage-ci lit une
     table et écrit quelques lignes. Les faire partager un verrou ferait sauter
     le rattrapage pendant toute la durée du passage de nuit — c'est-à-dire
     précisément quand un incident aurait pu laisser des exécutions en route. */
  @Cron(CHAQUE_DIX_MINUTES)
  async rattraperLesGenerations(): Promise<void> {
    try {
      await this.generation.reconcilierLesEnCours();
    } catch (err: unknown) {
      /* On journalise et on laisse passer : ce rattrapage repassera dans dix
         minutes, et relever ici n'aurait personne pour l'entendre. */
      this.logger.error(`rattrapage des générations : ${String(err)}`);
    }
  }

  @Cron(CHAQUE_JOUR)
  async passageQuotidien(): Promise<void> {
    if (this.enCours) {
      this.logger.warn("passage précédent encore en cours, celui-ci est sauté");
      return;
    }
    this.enCours = true;
    try {
      await this.executer();
    } finally {
      this.enCours = false;
    }
  }

  /* Exposé à part du déclencheur : c'est ce qui rend le passage éprouvable
     sans déplacer l'horloge, et rejouable à la main depuis une console le jour
     où un incident aura fait manquer une nuit. */
  async executer(): Promise<void> {
    for (const [nom, etape] of [
      ["déroulement", () => this.deroulement.derouler()],
      ["programmation", () => this.programmation.programmerRappels()],
      ["relance globale", () => this.relances.enrichissementGlobal()],
      ["relance par personne", () => this.relances.enrichissementParPersonne()],
      ["activation", () => this.relances.activations()],
      /* AVANT l'envoi, et à part du reste : ce qu'on rattrape ici n'est pas une
         notification mais de l'argent. Une exécution restée en attente laisse un
         crédit débité pour rien, et personne ne le signale — l'utilisateur voit
         un écran qui tourne, puis passe à autre chose. */
      ["générations abandonnées", () => this.generation.reconcilierLesEnCours()],
      ["envoi", () => this.envoi.envoyer()],
    ] as [string, () => Promise<unknown>][]) {
      try {
        await etape();
      } catch (err: unknown) {
        // On journalise et on continue : voir l'en-tête. Les étapes ne
        // dépendent pas de la réussite de la précédente, seulement de son
        // passage.
        this.logger.error(
          `étape « ${nom} » en échec : ${err instanceof Error ? err.message : "cause inconnue"}`,
        );
      }
    }
  }
}
