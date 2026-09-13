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
/* LES MOTIFS S'ACCUMULENT EN COMPTEUR, pas en tableau : on les range par code au
   fil des lignes, et on ne les met en forme — avec leurs libellés, triés —
   qu'une fois tout compté. Bâtir le tableau au fur et à mesure imposerait de
   chercher le code déjà présent à chaque ligne. */
type Comptes = { produites: number; gestes: Axe; avis: Axe; motifs: Map<string, number> };

const AXE_VIDE: Axe = { pour: 0, contre: 0, sans: 0 };
const rienDeCompte = (): Comptes => ({
  produites: 0, gestes: { ...AXE_VIDE }, avis: { ...AXE_VIDE }, motifs: new Map(),
});

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
    const libelles = await this.libellesDesMotifs();

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
        ...this.rendre(parConfig.get(v.id), libelles),
      })),
      horsVersion: this.rendre(parConfig.get(null), libelles),
    };
  }

  /* DU PLUS FRÉQUENT AU PLUS RARE, et le code départage à égalité — sans ce
     second critère, deux motifs à trois changeraient de place d'une lecture à
     l'autre, et l'écran donnerait l'impression de bouger tout seul. */
  private rendre(c: Comptes | undefined, libelles: Map<string, { fr: string; en: string }>) {
    const compte = c ?? rienDeCompte();
    return {
      produites: compte.produites,
      gestes: compte.gestes,
      avis: compte.avis,
      motifs: [...compte.motifs.entries()]
        .map(([code, n]) => ({
          code,
          /* LE CODE EN REPLI, jamais un trou. Il n'y a pas de clé étrangère vers
             le registre : un motif supprimé pour de bon laisse des comptes
             orphelins. Les taire ferait un total qui ne tombe pas juste, et
             c'est précisément le chiffre qu'on veut pouvoir croire. */
          fr: libelles.get(code)?.fr ?? code,
          en: libelles.get(code)?.en ?? code,
          n,
        }))
        .sort((a, b) => b.n - a.n || a.code.localeCompare(b.code)),
    };
  }

  /* LE REGISTRE ENTIER, RETIRÉS COMPRIS. Filtrer sur `is_active` perdrait le
     libellé des motifs qu'on ne propose plus mais qui ont déjà justifié des
     rejets — et c'est justement l'historique qu'on vient lire ici. */
  private async libellesDesMotifs(): Promise<Map<string, { fr: string; en: string }>> {
    const lignes = await this.prisma.feedbackReason.findMany({
      select: { code: true, labelFr: true, labelEn: true },
    });
    return new Map(lignes.map((l) => [l.code, { fr: l.labelFr, en: l.labelEn }]));
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
      motif: string | null;
    }[],
  ): Map<string | null, Comptes> {
    const par = new Map<string | null, Comptes>();
    for (const l of lignes) {
      const c = par.get(l.cle) ?? rienDeCompte();
      c.produites += l.nombre;
      c.gestes[l.geste] += l.nombre;
      c.avis[l.avis] += l.nombre;
      /* ON NE COMPTE LE MOTIF QUE SUR UN REJET. La base garantit qu'il n'y en a
         pas ailleurs, mais s'y fier sans le dire ferait qu'une ligne écrite
         hors du service — une reprise de données, une main dans psql — se
         retrouverait dans une ventilation censée expliquer `avis.contre`. */
      if (l.motif !== null && l.avis === "contre")
        c.motifs.set(l.motif, (c.motifs.get(l.motif) ?? 0) + l.nombre);
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
      by: ["studioConfigId", "status", "feedback", "feedbackReasonCode"],
      _count: { _all: true },
    });
    return this.ranger(lignes.map((l) => ({
      cle: l.studioConfigId,
      geste: l.status === "sent" ? "pour" as const
        : l.status === "rejected" ? "contre" as const : "sans" as const,
      avis: this.pouce(l.feedback),
      motif: l.feedbackReasonCode,
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
      by: [colonne, "status", "feedback", "feedbackReasonCode"],
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
      motif: l.feedbackReasonCode,
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
        feedback: true, feedbackReasonCode: true, wishlistItemId: true, acceptedAt: true,
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
      motif: l.feedbackReasonCode,
      nombre: 1,
    })));
  }
}
