import { Inject, Injectable } from "@nestjs/common";
import type { NatureStudio, Performance, UniteProduite } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

/* CE QUE LES VERSIONS ONT PRODUIT — et c'est la lecture qui donne son sens à
 * tout l'atelier.
 *
 * Jusqu'au 12 septembre on publiait sans jamais savoir si on avait amélioré
 * quoi que ce soit : aucune production ne portait d'avis négatif, et aucune ne
 * disait quelle version l'avait produite. Les deux manquaient ENSEMBLE et il
 * les fallait ensemble — un pouce en bas sans savoir quelle version l'a produit
 * ne mesure rien, et une version publiée sans avis ne dit pas si elle vaut
 * mieux que la précédente.
 *
 * L'UNITÉ COMPTÉE N'EST PAS LA MÊME PARTOUT. Un message, un portrait, une IDÉE.
 * Le jeu d'idées porte la version, mais l'avis se pose idée par idée : compter
 * les jeux dirait « trois productions » là où quinze avis ont été rendus. La
 * réponse nomme donc son unité, pour qu'un panneau ne compare pas des choses
 * qui ne se comparent pas.
 */
type Comptes = { produites: number; positifs: number; negatifs: number; sansAvis: number };

const RIEN: Comptes = { produites: 0, positifs: 0, negatifs: 0, sansAvis: 0 };

const UNITE: Record<NatureStudio, UniteProduite> = {
  message: "message",
  idees: "idee",
  portrait: "portrait",
  portrait_brief: "portrait",
};

@Injectable()
export class StudioPerformanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async lire(nature: NatureStudio): Promise<Performance> {
    const parConfig = await this.compter(nature);

    /* TOUTES LES VERSIONS PARAISSENT, y compris celles qui n'ont rien produit.
       Une version publiée puis remplacée le lendemain a zéro production, et
       c'est un fait à voir : la masquer laisserait croire à un trou dans la
       numérotation, ou pire, à une version qu'on aurait oublié de mesurer. */
    const versions = await this.prisma.studioConfig.findMany({
      where: { kind: nature, version: { not: null } },
      orderBy: [{ version: "desc" }],
      select: { id: true, version: true, publishedAt: true },
    });

    return {
      unite: UNITE[nature],
      versions: versions.map((v) => ({
        configId: v.id,
        version: v.version,
        publieeLe: v.publishedAt?.toISOString() ?? null,
        ...(parConfig.get(v.id) ?? RIEN),
      })),
      horsVersion: parConfig.get(null) ?? RIEN,
    };
  }

  /* La clé `null` porte ce qui a été produit SANS configuration publiée, par le
     gabarit du code. Compté à part et jamais attribué : lui donner une version
     ferait porter à une configuration des avis qu'elle n'a pas mérités, et
     c'est précisément le chiffre qu'on veut pouvoir croire. */
  private async compter(nature: NatureStudio): Promise<Map<string | null, Comptes>> {
    if (nature === "idees") return this.compterIdees();
    if (nature === "message") return this.compterMessages();
    return this.compterPortraits(nature);
  }

  private ranger(
    lignes: { cle: string | null; positif: boolean; negatif: boolean; nombre: number }[],
  ): Map<string | null, Comptes> {
    const par = new Map<string | null, Comptes>();
    for (const l of lignes) {
      const c = par.get(l.cle) ?? { ...RIEN };
      c.produites += l.nombre;
      if (l.positif) c.positifs += l.nombre;
      else if (l.negatif) c.negatifs += l.nombre;
      else c.sansAvis += l.nombre;
      par.set(l.cle, c);
    }
    return par;
  }

  /* `edited` COMPTE COMME SANS AVIS, et ce n'est pas un oubli. Il dit « je l'ai
     arrangé », pas « il ne va pas » : un message corrigé puis envoyé porte
     `sent`, donc `edited` seul désigne un texte touché et jamais confirmé. Le
     ranger du côté négatif mesurerait la retouche au lieu du ratage. */
  private async compterMessages(): Promise<Map<string | null, Comptes>> {
    const lignes = await this.prisma.generatedMessage.groupBy({
      by: ["studioConfigId", "status"],
      _count: { _all: true },
    });
    return this.ranger(lignes.map((l) => ({
      cle: l.studioConfigId,
      positif: l.status === "sent",
      negatif: l.status === "rejected",
      nombre: l._count._all,
    })));
  }

  private async compterPortraits(nature: "portrait" | "portrait_brief"): Promise<Map<string | null, Comptes>> {
    /* DEUX COLONNES, DEUX NATURES. `studio_config_id` est le CATALOGUE —
       ambiances, compositions, modèle d'image ; `brief_studio_config_id` est la
       consigne qui a choisi les mots. Un même portrait compte donc une fois de
       chaque côté, et c'est juste : les deux versions ont bien contribué à ce
       qu'on approuve ou rejette. */
    const colonne = nature === "portrait" ? "studioConfigId" : "briefStudioConfigId";
    const lignes = await this.prisma.portrait.groupBy({
      by: [colonne, "status"],
      _count: { _all: true },
    });
    return this.ranger(lignes.map((l) => ({
      cle: (l as Record<string, unknown>)[colonne] as string | null,
      positif: l.status === "approved",
      negatif: l.status === "rejected",
      nombre: l._count._all,
    })));
  }

  /* L'AVIS SE POSE IDÉE PAR IDÉE, la version se porte sur le JEU. On compte
     donc les idées en remontant à leur jeu — c'est la seule jointure de ce
     service, et elle est inévitable : poser la version sur chaque idée la
     répéterait cinq fois pour un fait qui ne varie pas. */
  private async compterIdees(): Promise<Map<string | null, Comptes>> {
    const lignes = await this.prisma.generatedIdea.findMany({
      select: { feedback: true, set: { select: { studioConfigId: true } } },
    });
    return this.ranger(lignes.map((l) => ({
      cle: l.set.studioConfigId,
      positif: l.feedback === "up",
      negatif: l.feedback === "down",
      nombre: 1,
    })));
  }
}
