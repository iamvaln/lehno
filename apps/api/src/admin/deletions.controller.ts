import { Controller, Get, Inject, Injectable, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { RoleGuard } from "./role.guard.js";

const JOUR_MS = 24 * 60 * 60_000;
const DELAI_DEFAUT = 30;
const LIMITE_DEFAUT = 25;
const LIMITE_MAX = 200;

const requeteSchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIMITE_MAX).optional(),
  cursor: z.string().uuid().optional(),
  echeance: z.enum(["today", "week"]).optional(),
}).strict();

export type DemandeSuppression = {
  id: string;
  compte: string;
  demandeeLe: string;
  echeance: string;
  joursRestants: number;
  etat: "en_cours" | "echue";
};

@Injectable()
export class DeletionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // L'échéance ne vit pas en colonne : elle se calcule depuis la demande et le
  // délai réglé en base. La figer à l'écriture la rendrait fausse dès que le
  // paramètre change — et c'est précisément un paramètre qu'on règle depuis le
  // back-office.
  private async delaiEnJours(): Promise<number> {
    const ligne = await this.prisma.systemParameter.findUnique({
      where: { key: "account_grace_period_days" },
    });
    const valeur = Number(ligne?.value);
    return Number.isFinite(valeur) && valeur > 0 ? valeur : DELAI_DEFAUT;
  }

  async lister(requete: z.infer<typeof requeteSchema>): Promise<{ items: DemandeSuppression[]; nextCursor: string | null }> {
    const delai = await this.delaiEnJours();
    const limite = requete.limit ?? LIMITE_DEFAUT;
    const maintenant = Date.now();

    // Le filtre porte sur l'échéance, mais la base ne connaît que la date de
    // demande : on traduit l'une en l'autre plutôt que de tout charger.
    const bornes: { lte?: Date } = {};
    if (requete.echeance === "today") bornes.lte = new Date(maintenant - delai * JOUR_MS + JOUR_MS);
    if (requete.echeance === "week") bornes.lte = new Date(maintenant - delai * JOUR_MS + 7 * JOUR_MS);

    const lignes = await this.prisma.user.findMany({
      where: {
        status: "pending_deletion",
        deletionRequestedAt: { not: null, ...bornes },
      },
      // La plus urgente d'abord : c'est une file de travail, pas un annuaire.
      // L'identifiant départage deux demandes de la même milliseconde, sans
      // quoi le curseur sauterait une ligne ou la rendrait deux fois.
      orderBy: [{ deletionRequestedAt: "asc" }, { id: "asc" }],
      take: limite + 1,
      ...(requete.cursor ? { cursor: { id: requete.cursor }, skip: 1 } : {}),
      select: { id: true, username: true, deletionRequestedAt: true },
    });

    const page = lignes.slice(0, limite);
    return {
      items: page.map((u) => {
        const demandee = u.deletionRequestedAt as Date;
        const echeance = new Date(demandee.getTime() + delai * JOUR_MS);
        const restants = Math.ceil((echeance.getTime() - maintenant) / JOUR_MS);
        return {
          id: u.id,
          compte: u.username,
          demandeeLe: demandee.toISOString(),
          echeance: echeance.toISOString(),
          joursRestants: restants,
          etat: restants <= 0 ? "echue" : "en_cours",
        };
      }),
      nextCursor: lignes.length > limite ? (page.at(-1)?.id ?? null) : null,
    };
  }
}

// Aucune écriture ici, et c'est délibéré. Les deux gestes du délai de grâce —
// restaurer, effacer sans attendre — sont des changements d'état, que
// PATCH /admin/users/{id} porte déjà avec son motif obligatoire et sa règle de
// rôle. Un second chemin d'écriture finirait par diverger du premier : l'un
// journalisant, l'autre non.
@Controller("admin/deletions")
@UseGuards(AdminGuard, RoleGuard)
export class DeletionsController {
  constructor(@Inject(DeletionsService) private readonly service: DeletionsService) {}

  @Get()
  lister(@Query(new ZodValidationPipe(requeteSchema)) requete: z.infer<typeof requeteSchema>) {
    return this.service.lister(requete);
  }
}
