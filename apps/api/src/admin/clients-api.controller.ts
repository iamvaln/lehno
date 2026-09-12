import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import {
  creerClientApiSchema, majClientApiSchema, rotationClientApiSchema,
} from "@lehno/contracts";
import type {
  ClientApi, ClientApiAvecCle, ClientsApi,
  CreerClientApiInput, MajClientApiInput, RotationClientApiInput,
} from "@lehno/contracts";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ClientApiService, engendrerUneCle, hacherLaCle } from "../clients/client-api.service.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

type RequeteAdmin = { adminId: string };

type Ligne = {
  id: string;
  clientId: string;
  label: string;
  clientType: string;
  environment: string;
  isActive: boolean;
  rotatedAt: Date | null;
  createdAt: Date;
};

/* Les six paires qui nous appellent — trois plateformes × deux environnements.
 *
 * TOUT PASSE PAR LE MOTIF D'AUDIT, et ce n'est pas une formalité : couper un
 * client coupe UNE APPLICATION ENTIÈRE, sur tous les appareils à la fois.
 * Personne ne doit pouvoir le faire sans laisser son nom et sa raison.
 *
 * LA CLÉ NE SE RELIT JAMAIS. Elle paraît une fois à la création, une fois à la
 * rotation, et la base n'en garde que le haché. Une clé perdue se remplace.
 */
@Controller("admin/api-clients")
@UseGuards(AdminGuard, RoleGuard)
@Role("admin")
export class ClientsApiController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
    @Inject(ClientApiService) private readonly clients: ClientApiService,
  ) {}

  @Get()
  async lister(): Promise<ClientsApi> {
    const lignes = await this.prisma.apiClient.findMany({
      orderBy: [{ isActive: "desc" }, { label: "asc" }],
    });
    return { items: lignes.map((l) => rendre(l as Ligne)) };
  }

  /* 201 : une ressource neuve, dont l'appelant apprend l'identifiant — ET la
     clé, qu'il ne reverra jamais. L'écran doit le dire au moment où il
     l'affiche : c'est le seul instant où quelqu'un peut la copier. */
  @Post()
  async creer(
    @Req() req: RequeteAdmin,
    @Body(new ZodValidationPipe(creerClientApiSchema)) corps: CreerClientApiInput,
  ): Promise<ClientApiAvecCle> {
    const cle = engendrerUneCle();

    /* LE MOTIF SE VÉRIFIE AVANT L'ÉCRITURE, comme partout ailleurs : consigner
       après coup laisserait une ligne créée sans trace si le motif est refusé. */
    await this.journal.consigner({
      auteurId: req.adminId,
      action: "api_client_create",
      geste: "api_client_create",
      motif: corps.motif,
      ...(corps.reasonCode !== undefined ? { codeMotif: corps.reasonCode } : {}),
      details: { label: corps.label, clientType: corps.clientType, environment: corps.environment },
    });

    const ligne = await this.prisma.apiClient.create({
      data: {
        /* Lisible et collable, avec de quoi le reconnaître à l'œil dans un
           journal : `mobile_ios_prod_a3f9…`. Le suffixe aléatoire évite qu'un
           second client du même type et du même environnement — un build de
           test, par exemple — ne puisse pas coexister. */
        clientId: `${corps.clientType}_${corps.environment}_${randomBytes(4).toString("hex")}`,
        label: corps.label,
        clientType: corps.clientType as never,
        environment: corps.environment as never,
        keyHash: hacherLaCle(cle),
      },
    });
    return { ...rendre(ligne as Ligne), cle };
  }

  /* LA ROTATION GARDE L'IDENTIFIANT, et c'est tout son intérêt : les chiffres
     déjà notés restent comparables, et une clé compromise se remplace sans
     rompre la série. C'est le seul avantage réel de la clé — voir le §3 du
     plan, qui dit pourquoi elle n'est pas un secret. */
  @Post(":id/rotate")
  async tourner(
    @Req() req: RequeteAdmin,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rotationClientApiSchema)) corps: RotationClientApiInput,
  ): Promise<ClientApiAvecCle> {
    const existant = await this.lire(id);
    const cle = engendrerUneCle();

    await this.journal.consigner({
      auteurId: req.adminId,
      action: "api_client_rotate",
      geste: "api_client_rotate",
      motif: corps.motif,
      ...(corps.reasonCode !== undefined ? { codeMotif: corps.reasonCode } : {}),
      cibleType: "api_client",
      cibleId: id,
      details: { clientId: existant.clientId },
    });

    const ligne = await this.prisma.apiClient.update({
      where: { id },
      data: { keyHash: hacherLaCle(cle), rotatedAt: new Date() },
    });

    /* ON OUBLIE LE CACHE TOUT DE SUITE. Soixante secondes d'attente pour
       révoquer une clé compromise, c'est cinquante-neuf de trop — et c'est
       précisément le cas où l'on tourne une clé. */
    this.clients.oublier(existant.clientId);
    return { ...rendre(ligne as Ligne), cle };
  }

  @Patch(":id")
  async basculer(
    @Req() req: RequeteAdmin,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(majClientApiSchema)) corps: MajClientApiInput,
  ): Promise<ClientApi> {
    const existant = await this.lire(id);

    await this.journal.consigner({
      auteurId: req.adminId,
      action: "api_client_update",
      geste: "api_client_update",
      motif: corps.motif,
      ...(corps.reasonCode !== undefined ? { codeMotif: corps.reasonCode } : {}),
      cibleType: "api_client",
      cibleId: id,
      details: { clientId: existant.clientId, avant: existant.isActive, apres: corps.isActive },
    });

    const ligne = await this.prisma.apiClient.update({
      where: { id },
      data: { isActive: corps.isActive },
    });
    this.clients.oublier(existant.clientId);
    return rendre(ligne as Ligne);
  }

  private async lire(id: string): Promise<Ligne> {
    const ligne = await this.prisma.apiClient.findUnique({ where: { id } });
    if (!ligne) throw new AppError("not_found", "unknown api client");
    return ligne as Ligne;
  }
}

/* `keyHash` NE SORT JAMAIS, même haché. Le rendre n'apprendrait rien d'utile à
   un écran et offrirait à qui lit la réponse de quoi éprouver des clés hors
   ligne — ce que la comparaison en temps constant évite justement en ligne. */
function rendre(l: Ligne): ClientApi {
  return {
    id: l.id,
    clientId: l.clientId,
    label: l.label,
    clientType: l.clientType as ClientApi["clientType"],
    environment: l.environment as ClientApi["environment"],
    isActive: l.isActive,
    rotatedAt: l.rotatedAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
  };
}
