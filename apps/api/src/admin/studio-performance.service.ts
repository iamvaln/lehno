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
/* DEUX AXES, ET LA MÊME FORME POUR LES DEUX.
 *
 * La première rédaction n'en tenait qu'un, et la même colonne ne comptait pas
 * la même chose selon la nature : le STATUT pour le message et le portrait,
 * l'AVIS pour les idées. « Envoyé » et « pouce en haut » tombaient dans la même
 * case, dans un écran fait pour comparer les trois.
 *
 * LES GESTES sont une préférence RÉVÉLÉE — on ne demande rien à personne, on
 * regarde ce qui a été fait. L'AVIS est déclaré, donc rare : donner un avis est
 * un geste qu'on ne franchit pas forcément. Rare ne veut pas dire faible, c'est
 * le seul des deux qui dise si le texte était BON et non seulement s'il a
 * servi. */
type Axe = { pour: number; contre: number; sans: number };
type Comptes = { produites: number; gestes: Axe; avis: Axe };

const AXE_VIDE: Axe = { pour: 0, contre: 0, sans: 0 };
const RIEN: Comptes = { produites: 0, gestes: { ...AXE_VIDE }, avis: { ...AXE_VIDE } };

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
    lignes: {
      cle: string | null; nombre: number;
      geste: "pour" | "contre" | "sans";
      avis: "pour" | "contre" | "sans";
    }[],
  ): Map<string | null, Comptes> {
    const par = new Map<string | null, Comptes>();
    for (const l of lignes) {
      const c = par.get(l.cle)
        ?? { produites: 0, gestes: { ...AXE_VIDE }, avis: { ...AXE_VIDE } };
      c.produites += l.nombre;
      c.gestes[l.geste] += l.nombre;
      c.avis[l.avis] += l.nombre;
      par.set(l.cle, c);
    }
    return par;
  }

  /** Le pouce, rangé sur son axe. Nul veut dire « personne n'a tranché ». */
  private pouce(f: "up" | "down" | null): "pour" | "contre" | "sans" {
    return f === "up" ? "pour" : f === "down" ? "contre" : "sans";
  }

  /* `edited` COMPTE COMME SANS AVIS, et ce n'est pas un oubli. Il dit « je l'ai
     arrangé », pas « il ne va pas » : un message corrigé puis envoyé porte
     `sent`, donc `edited` seul désigne un texte touché et jamais confirmé. Le
     ranger du côté négatif mesurerait la retouche au lieu du ratage. */
  private async compterMessages(): Promise<Map<string | null, Comptes>> {
    /* ON GROUPE SUR LES DEUX COLONNES, puisqu'on tient deux axes. Grouper sur
       le seul statut perdrait l'avis, et c'est ce que faisait la première
       rédaction — le `feedback` posé sur le message n'était compté nulle part. */
    const lignes = await this.prisma.generatedMessage.groupBy({
      by: ["studioConfigId", "status", "feedback"],
      _count: { _all: true },
    });
    return this.ranger(lignes.map((l) => ({
      cle: l.studioConfigId,
      geste: l.status === "sent" ? "pour" as const
        : l.status === "rejected" ? "contre" as const : "sans" as const,
      avis: this.pouce(l.feedback),
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
      by: [colonne, "status", "feedback"],
      _count: { _all: true },
    });
    /* `generated` ET `composed` TOMBENT DU CÔTÉ SANS AVIS, et c'est le cas le
       plus fréquent : la plupart des portraits y resteront. Refaire n'est pas
       rejeter — on peut en produire cinq en changeant les réglages et les garder
       tous —, et rien n'oblige à se prononcer. Les ranger d'un côté ou de
       l'autre ferait dire à la moyenne l'inverse de ce qui s'est passé. */
    return this.ranger(lignes.map((l) => ({
      cle: (l as Record<string, unknown>)[colonne] as string | null,
      geste: l.status === "approved" ? "pour" as const
        : l.status === "rejected" ? "contre" as const : "sans" as const,
      avis: this.pouce(l.feedback),
      nombre: l._count._all,
    })));
  }

  /* L'AVIS SE POSE IDÉE PAR IDÉE, la version se porte sur le JEU. On compte
     donc les idées en remontant à leur jeu — c'est la seule jointure de ce
     service, et elle est inévitable : poser la version sur chaque idée la
     répéterait cinq fois pour un fait qui ne varie pas. */
  private async compterIdees(): Promise<Map<string | null, Comptes>> {
    const lignes = await this.prisma.generatedIdea.findMany({
      select: {
        feedback: true, wishlistItemId: true, acceptedAt: true,
        set: { select: { studioConfigId: true } },
      },
    });
    /* LES IDÉES ONT UN GESTE, ELLES AUSSI, et la première rédaction le prenait
       pour leur avis. Le geste d'une idée est d'être RETENUE — elle devient un
       souhait —, et le service des idées le dit déjà : « parmi ce que le modèle
       a proposé, qu'est-ce qui a été retenu, qui est la seconde mesure de
       pertinence après l'avis ».
       `acceptedAt` SANS `wishlistItemId` est le cas intéressant — retenue, puis
       le souhait supprimé de la liste. Elle a bien été retenue : c'est la date
       qui fait foi, pas le lien. */
    return this.ranger(lignes.map((l) => ({
      cle: l.set.studioConfigId,
      geste: l.acceptedAt === null ? "sans" as const : "pour" as const,
      avis: this.pouce(l.feedback),
      nombre: 1,
    })));
  }
}
