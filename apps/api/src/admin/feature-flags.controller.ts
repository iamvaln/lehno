import { Body, Controller, Get, Inject, Injectable, Patch, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import {
  DRAPEAUX, CLES_DRAPEAUX, basculeDrapeauSchema,
  type CleDrapeau, type PorteeDrapeau,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

/**
 * L'administration des drapeaux.
 *
 * Le registre est en code et la table ne porte que l'état : c'est donc le
 * registre qu'on énumère, pas la table. Une clé sans ligne paraît quand même,
 * éteinte — sinon un drapeau auquel personne n'a touché serait invisible, et
 * personne ne pourrait l'allumer.
 *
 * Le corollaire vaut aussi dans l'autre sens : le registre est **fermé**. Une
 * clé qui n'y figure pas n'existe pas, et l'écrire en base créerait une ligne
 * que rien ne lit — un drapeau qui ne garde rien, et qui ment sur ce qu'il
 * éteint.
 */

/**
 * Ce que l'extinction d'un drapeau emporte : tous ceux qui en dépendent, de
 * proche en proche. C'est l'inverse de `requiert`, et le §5.7 demande de
 * l'annoncer **avant** la bascule plutôt que de le laisser découvrir — éteindre
 * le Mur emporte le dépôt de vœux et la réservation.
 *
 * Calculé depuis le registre à chaque appel : une table de correspondance
 * écrite à la main aurait divergé au premier drapeau ajouté.
 */
export function emporteDans(requiert: Record<string, readonly string[]>, cle: string): string[] {
  const emportes = new Set<string>();
  const file: string[] = [cle];

  while (file.length > 0) {
    const courant = file.shift() as string;
    for (const [candidat, prerequis] of Object.entries(requiert)) {
      if (emportes.has(candidat) || candidat === cle) continue;
      if (!prerequis.includes(courant)) continue;
      emportes.add(candidat);
      // La remise en file est ce qui rend la cascade transitive : si C dépend
      // de B et B de A, éteindre A doit emporter C aussi. Le registre n'a
      // aujourd'hui qu'un seul niveau, mais rien ne garantit qu'il en restera
      // là — et une cascade qui s'arrête au premier rang mentirait en silence.
      file.push(candidat);
    }
  }
  return [...emportes];
}

const GRAPHE: Record<string, readonly string[]> = Object.fromEntries(
  CLES_DRAPEAUX.map((cle) => [cle, DRAPEAUX[cle].requiert]),
);

function emportePar(cle: CleDrapeau): string[] {
  return emporteDans(GRAPHE, cle);
}

const estCleConnue = (cle: string): cle is CleDrapeau =>
  (CLES_DRAPEAUX as readonly string[]).includes(cle);

@Injectable()
export class AdminFeatureFlagsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  async lister() {
    const lignes = await this.prisma.featureFlag.findMany({
      where: { key: { in: [...CLES_DRAPEAUX] } },
      include: { updatedBy: { select: { email: true } } },
    });
    const parCle = new Map(lignes.map((l) => [l.key, l]));

    // Ligne absente vaut éteint, comme partout ailleurs dans ce projet.
    const brut = new Map<string, boolean>(
      CLES_DRAPEAUX.map((cle) => [cle, parCle.get(cle)?.enabled ?? false]),
    );

    // L'état effectif, dépendances résolues. Un drapeau allumé dont un
    // prérequis est éteint reste inerte : ne montrer que l'interrupteur
    // laisserait croire qu'une fonctionnalité tourne alors que personne ne la
    // voit.
    const effectif = (cle: CleDrapeau): boolean => {
      if (!(brut.get(cle) ?? false)) return false;
      return DRAPEAUX[cle].requiert.every((r) => effectif(r as CleDrapeau));
    };

    return {
      items: CLES_DRAPEAUX.map((cle) => {
        const ligne = parCle.get(cle);
        return {
          cle,
          gouverne: DRAPEAUX[cle].gouverne,
          portee: [...DRAPEAUX[cle].portee] as PorteeDrapeau[],
          requiert: [...DRAPEAUX[cle].requiert],
          emporte: emportePar(cle),
          ecrans: [...DRAPEAUX[cle].ecrans],
          chemins: [...DRAPEAUX[cle].chemins],
          actif: brut.get(cle) ?? false,
          effectif: effectif(cle),
          misAJourLe: (ligne?.updatedAt ?? new Date(0)).toISOString(),
          parQui: ligne?.updatedBy?.email ?? null,
        };
      }),
    };
  }

  async basculer(auteurId: string, entree: z.infer<typeof basculeDrapeauSchema>) {
    if (!estCleConnue(entree.cle)) throw new AppError("not_found", "unknown feature flag");

    const avant = await this.prisma.featureFlag.findUnique({ where: { key: entree.cle } });

    // La transaction tient les deux ensemble : un drapeau basculé sans trace,
    // ou une trace sans bascule, valent tous deux moins que rien. Le journal
    // écrit en premier — s'il refuse le motif, l'état n'a pas bougé.
    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId,
        action: "feature_flag_update",
        motif: entree.reason,
        cibleType: "feature_flag",
        details: { key: entree.cle, from: avant?.enabled ?? false, to: entree.actif },
      }, tx);

      const apres = await tx.featureFlag.upsert({
        where: { key: entree.cle },
        create: { key: entree.cle, enabled: entree.actif, updatedByAdminId: auteurId },
        update: { enabled: entree.actif, updatedByAdminId: auteurId },
      });
      return { cle: apres.key, actif: apres.enabled };
    });
  }
}

@Controller("admin/feature-flags")
@UseGuards(AdminGuard, RoleGuard)
// Toute la famille Économie est fermée au support, y compris en lecture
// (ux-admin §6) : ce sont les leviers qui engagent le service.
@Role("admin")
export class AdminFeatureFlagsController {
  constructor(@Inject(AdminFeatureFlagsService) private readonly service: AdminFeatureFlagsService) {}

  @Get()
  lister() {
    return this.service.lister();
  }

  @Patch()
  async basculer(
    @Body(new ZodValidationPipe(basculeDrapeauSchema)) corps: z.infer<typeof basculeDrapeauSchema>,
    @Req() requete: { admin?: { id: string } },
  ) {
    return this.service.basculer(requete.admin?.id ?? "", corps);
  }
}
