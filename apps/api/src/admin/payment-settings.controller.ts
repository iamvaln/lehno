import { Body, Controller, Get, Inject, Injectable, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { motifSchema } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

/**
 * Les trois tables que l'administration règle : paliers, canaux, comptes de
 * collecte.
 *
 * **Rien ne se supprime.** Un paiement passé référence son canal et son compte,
 * et leur barème explique le montant versé ce jour-là. Les effacer rendrait ce
 * paiement inexplicable — d'où la désactivation, et l'absence de tout chemin de
 * suppression.
 *
 * **Chaque modification passe au journal**, avec son motif : ce sont les
 * leviers qui décident de ce qu'un client paie.
 */

const palierSchema = z.object({
  montant: z.number().positive().optional(),
  credits: z.number().int().positive().optional(),
  remisePourcent: z.number().int().nullable().optional(),
  position: z.number().int().optional(),
  actif: z.boolean().optional(),
  reason: motifSchema,
}).strict();

const canalCreationSchema = z.object({
  nature: z.enum(["mobile_money", "card"]),
  operateur: z.string().min(1).max(40),
  pays: z.string().length(2),
  libelle: z.string().min(1).max(80),
  fraisPourcent: z.number().min(0).optional(),
  fraisFixe: z.number().min(0).optional(),
  fraisMin: z.number().min(0).nullable().optional(),
  fraisMax: z.number().min(0).nullable().optional(),
  fraisPortesPar: z.enum(["payer", "payee"]).optional(),
  devise: z.string().length(3).optional(),
  position: z.number().int().nullable().optional(),
  reason: motifSchema,
}).strict();

// `actif` ne figure pas à la création — un canal naît en service — mais se
// règle ensuite : c'est la seule façon de le retirer, puisqu'il ne se supprime
// pas. Nature, opérateur et pays n'y sont pas non plus : les changer ferait un
// autre canal, et le paiement passé qui le référence deviendrait inexplicable.
const canalModificationSchema = z.object({
  libelle: z.string().min(1).max(80).optional(),
  fraisPourcent: z.number().min(0).optional(),
  fraisFixe: z.number().min(0).optional(),
  fraisMin: z.number().min(0).nullable().optional(),
  fraisMax: z.number().min(0).nullable().optional(),
  fraisPortesPar: z.enum(["payer", "payee"]).optional(),
  position: z.number().int().nullable().optional(),
  actif: z.boolean().optional(),
  reason: motifSchema,
}).strict();

const compteCreationSchema = z.object({
  libelle: z.string().min(1).max(80),
  operateur: z.string().min(1).max(40),
  numero: z.string().min(1).max(32),
  visibleDansApp: z.boolean().optional(),
  position: z.number().int().nullable().optional(),
  reason: motifSchema,
}).strict();

const compteModificationSchema = z.object({
  libelle: z.string().min(1).max(80).optional(),
  operateur: z.string().min(1).max(40).optional(),
  numero: z.string().min(1).max(32).optional(),
  visibleDansApp: z.boolean().optional(),
  actif: z.boolean().optional(),
  position: z.number().int().nullable().optional(),
  reason: motifSchema,
}).strict();

@Injectable()
export class PaymentSettingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  // Une écriture et sa trace tiennent ensemble ou pas du tout : la transaction
  // s'en charge, et un refus à l'un ou l'autre bout défait le reste.
  //
  // Pour une modification, le journal écrit en premier — l'ordre ne change rien
  // à l'atomicité, mais il dit l'intention. Pour une création, il ne le peut
  // pas : la cible n'a pas encore d'identifiant, et une trace sans cible ne
  // sert à rien le jour où on la relit.
  private async creer(
    auteurId: string, action: string, motif: string, cibleType: string,
    details: Prisma.InputJsonObject,
    insertion: (tx: Prisma.TransactionClient) => Promise<{ id: string }>,
  ): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const cree = await insertion(tx);
      await this.journal.consigner(
        { auteurId, action, motif, cibleType, cibleId: cree.id, details }, tx,
      );
      return cree;
    });
  }

  private async ecrire<T>(
    auteurId: string, action: string, motif: string, cibleType: string, cibleId: string,
    details: Prisma.InputJsonObject,
    ecriture: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({ auteurId, action, motif, cibleType, cibleId, details }, tx);
      return ecriture(tx);
    });
  }

  // ─── Les paliers ─────────────────────────────────────────────────────────

  async paliers() {
    const lignes = await this.prisma.creditBundle.findMany({ orderBy: { position: "asc" } });
    return {
      items: lignes.map((p) => ({
        id: p.id,
        montant: Number(p.amount),
        devise: p.currency,
        credits: p.credits,
        remisePourcent: p.bonusPercent,
        position: p.position,
        actif: p.isActive,
      })),
    };
  }

  async modifierPalier(auteurId: string, id: string, entree: z.infer<typeof palierSchema>) {
    const avant = await this.prisma.creditBundle.findUnique({ where: { id } });
    if (!avant) throw new AppError("not_found", "unknown credit bundle");

    return this.ecrire(
      auteurId, "credit_bundle_update", entree.reason, "credit_bundle", id,
      { from: { credits: avant.credits, amount: Number(avant.amount), isActive: avant.isActive }, to: entree },
      async (tx) => {
        await tx.creditBundle.update({
          where: { id },
          data: {
            ...(entree.montant !== undefined ? { amount: entree.montant } : {}),
            ...(entree.credits !== undefined ? { credits: entree.credits } : {}),
            ...(entree.remisePourcent !== undefined ? { bonusPercent: entree.remisePourcent } : {}),
            ...(entree.position !== undefined ? { position: entree.position } : {}),
            ...(entree.actif !== undefined ? { isActive: entree.actif } : {}),
          },
        });
        return { id };
      },
    );
  }

  // ─── Les canaux ──────────────────────────────────────────────────────────

  async canaux() {
    const lignes = await this.prisma.paymentChannel.findMany({
      orderBy: [{ position: "asc" }, { operator: "asc" }],
    });
    return {
      items: lignes.map((c) => ({
        id: c.id,
        nature: c.kind,
        operateur: c.operator,
        pays: c.country,
        libelle: c.label,
        fraisPourcent: Number(c.feePercent),
        fraisFixe: Number(c.feeFixed),
        fraisMin: c.feeMin === null ? null : Number(c.feeMin),
        fraisMax: c.feeMax === null ? null : Number(c.feeMax),
        fraisPortesPar: c.feeBorneBy,
        devise: c.currency,
        actif: c.isActive,
        position: c.position,
      })),
    };
  }

  async creerCanal(auteurId: string, entree: z.infer<typeof canalCreationSchema>) {
    // Un opérateur n'a qu'un barème par pays : deux lignes concurrentes
    // rendraient l'aperçu indéterminé, et personne ne saurait laquelle a servi
    // à expliquer un paiement. La base le refuse ; on le dit avant, pour que
    // l'écran puisse l'expliquer.
    const existant = await this.prisma.paymentChannel.findUnique({
      where: { operator_country_kind: { operator: entree.operateur, country: entree.pays, kind: entree.nature } },
    });
    if (existant) throw new AppError("conflict", "a channel already exists for this operator and country");

    return this.creer(
      auteurId, "payment_channel_create", entree.reason, "payment_channel",
      { operator: entree.operateur, country: entree.pays, kind: entree.nature },
      async (tx) => {
        const cree = await tx.paymentChannel.create({
          data: {
            kind: entree.nature, operator: entree.operateur, country: entree.pays, label: entree.libelle,
            ...(entree.fraisPourcent !== undefined ? { feePercent: entree.fraisPourcent } : {}),
            ...(entree.fraisFixe !== undefined ? { feeFixed: entree.fraisFixe } : {}),
            ...(entree.fraisMin !== undefined ? { feeMin: entree.fraisMin } : {}),
            ...(entree.fraisMax !== undefined ? { feeMax: entree.fraisMax } : {}),
            ...(entree.fraisPortesPar !== undefined ? { feeBorneBy: entree.fraisPortesPar } : {}),
            ...(entree.devise !== undefined ? { currency: entree.devise } : {}),
            ...(entree.position !== undefined ? { position: entree.position } : {}),
          },
        });
        return { id: cree.id };
      },
    );
  }

  async modifierCanal(auteurId: string, id: string, entree: z.infer<typeof canalModificationSchema>) {
    const avant = await this.prisma.paymentChannel.findUnique({ where: { id } });
    if (!avant) throw new AppError("not_found", "unknown payment channel");

    return this.ecrire(
      auteurId, "payment_channel_update", entree.reason, "payment_channel", id,
      { from: { feePercent: Number(avant.feePercent), isActive: avant.isActive }, to: entree },
      async (tx) => {
        await tx.paymentChannel.update({
          where: { id },
          data: {
            ...(entree.libelle !== undefined ? { label: entree.libelle } : {}),
            ...(entree.fraisPourcent !== undefined ? { feePercent: entree.fraisPourcent } : {}),
            ...(entree.fraisFixe !== undefined ? { feeFixed: entree.fraisFixe } : {}),
            ...(entree.fraisMin !== undefined ? { feeMin: entree.fraisMin } : {}),
            ...(entree.fraisMax !== undefined ? { feeMax: entree.fraisMax } : {}),
            ...(entree.fraisPortesPar !== undefined ? { feeBorneBy: entree.fraisPortesPar } : {}),
            ...(entree.position !== undefined ? { position: entree.position } : {}),
            ...(entree.actif !== undefined ? { isActive: entree.actif } : {}),
          },
        });
        return { id };
      },
    );
  }

  // ─── Les comptes de collecte ─────────────────────────────────────────────

  async comptes() {
    const lignes = await this.prisma.collectionAccount.findMany({
      orderBy: [{ position: "asc" }, { label: "asc" }],
    });
    return {
      items: lignes.map((c) => ({
        id: c.id,
        libelle: c.label,
        operateur: c.operator,
        // En entier, et c'est voulu : ce numéro se dicte à un client au
        // téléphone, et se lit sur l'application de l'opérateur pour vérifier
        // une réception. Ce n'est pas une donnée de client, c'est un compte du
        // service.
        numero: c.number,
        visibleDansApp: c.isVisibleInApp,
        actif: c.isActive,
        position: c.position,
      })),
    };
  }

  async creerCompte(auteurId: string, entree: z.infer<typeof compteCreationSchema>) {
    return this.creer(
      auteurId, "collection_account_create", entree.reason, "collection_account",
      { label: entree.libelle, operator: entree.operateur },
      async (tx) => {
        const cree = await tx.collectionAccount.create({
          data: {
            label: entree.libelle, operator: entree.operateur, number: entree.numero,
            // Invisible par défaut : un compte s'ouvre, puis se montre. Poser
            // l'inverse le proposerait aux clients avant qu'on l'ait vérifié.
            ...(entree.visibleDansApp !== undefined ? { isVisibleInApp: entree.visibleDansApp } : {}),
            ...(entree.position !== undefined ? { position: entree.position } : {}),
          },
        });
        return { id: cree.id };
      },
    );
  }

  async modifierCompte(auteurId: string, id: string, entree: z.infer<typeof compteModificationSchema>) {
    const avant = await this.prisma.collectionAccount.findUnique({ where: { id } });
    if (!avant) throw new AppError("not_found", "unknown collection account");

    return this.ecrire(
      auteurId, "collection_account_update", entree.reason, "collection_account", id,
      { from: { isVisibleInApp: avant.isVisibleInApp, isActive: avant.isActive }, to: entree },
      async (tx) => {
        await tx.collectionAccount.update({
          where: { id },
          data: {
            ...(entree.libelle !== undefined ? { label: entree.libelle } : {}),
            ...(entree.operateur !== undefined ? { operator: entree.operateur } : {}),
            ...(entree.numero !== undefined ? { number: entree.numero } : {}),
            ...(entree.visibleDansApp !== undefined ? { isVisibleInApp: entree.visibleDansApp } : {}),
            ...(entree.actif !== undefined ? { isActive: entree.actif } : {}),
            ...(entree.position !== undefined ? { position: entree.position } : {}),
          },
        });
        return { id };
      },
    );
  }
}

// Toute la famille Économie est fermée au support, lecture comprise
// (ux-admin §6) : ce sont les leviers qui engagent le service et ses coûts.
@Controller("admin")
@UseGuards(AdminGuard, RoleGuard)
@Role("admin")
export class PaymentSettingsController {
  constructor(@Inject(PaymentSettingsService) private readonly service: PaymentSettingsService) {}

  private auteur(requete: { admin?: { id: string } }): string {
    return requete.admin?.id ?? "";
  }

  @Get("credit-bundles")
  paliers() {
    return this.service.paliers();
  }

  @Patch("credit-bundles/:id")
  modifierPalier(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(palierSchema)) corps: z.infer<typeof palierSchema>,
    @Req() requete: { admin?: { id: string } },
  ) {
    return this.service.modifierPalier(this.auteur(requete), id, corps);
  }

  @Get("payment-channels")
  canaux() {
    return this.service.canaux();
  }

  @Post("payment-channels")
  creerCanal(
    @Body(new ZodValidationPipe(canalCreationSchema)) corps: z.infer<typeof canalCreationSchema>,
    @Req() requete: { admin?: { id: string } },
  ) {
    return this.service.creerCanal(this.auteur(requete), corps);
  }

  @Patch("payment-channels/:id")
  modifierCanal(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(canalModificationSchema)) corps: z.infer<typeof canalModificationSchema>,
    @Req() requete: { admin?: { id: string } },
  ) {
    return this.service.modifierCanal(this.auteur(requete), id, corps);
  }

  @Get("collection-accounts")
  comptes() {
    return this.service.comptes();
  }

  @Post("collection-accounts")
  creerCompte(
    @Body(new ZodValidationPipe(compteCreationSchema)) corps: z.infer<typeof compteCreationSchema>,
    @Req() requete: { admin?: { id: string } },
  ) {
    return this.service.creerCompte(this.auteur(requete), corps);
  }

  @Patch("collection-accounts/:id")
  modifierCompte(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(compteModificationSchema)) corps: z.infer<typeof compteModificationSchema>,
    @Req() requete: { admin?: { id: string } },
  ) {
    return this.service.modifierCompte(this.auteur(requete), id, corps);
  }
}
