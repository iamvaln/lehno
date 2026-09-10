import { Controller, Get, Inject, Injectable, UseGuards } from "@nestjs/common";
import type { Dashboard } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminGuard } from "./admin.guard.js";
import { RoleGuard } from "./role.guard.js";

const JOUR_MS = 24 * 60 * 60_000;
const DELAI_DEFAUT = 30;
const PLAFOND_ALERTES = 3;
const FENETRE_ECHECS_H = 24;
const SEUIL_ECHECS = 20;
/* Ce que la file du tableau de bord montre au plus. Elle donne à voir ce qui
   attend, pas la section : au-delà, on ouvre la section. */
const PLAFOND_FILE = 10;

/* Les trois formes viennent du CONTRAT PUBLIÉ, jamais d'une définition locale.
 * C'est ce qui manquait : le service décrivait sa propre réponse, et personne
 * ne comparait les deux. Six semaines durant, l'écran a affiché « le chargement
 * n'a pas abouti » sur un appel qui rendait 200. */
type Alerte = Dashboard["alertes"][number];
type Indicateur = Dashboard["indicateurs"][number];
type ATraiter = Dashboard["aTraiter"][number];

/* Le nombre du jour, sans variation. La comparaison à hier demanderait de
   ranger un historique quotidien que rien ne tient aujourd'hui — et une
   variation inventée serait pire qu'absente : on y lirait une tendance. */
function chiffre(id: string, libelle: string, valeur: number, section: string | null): Indicateur {
  return { id, libelle, valeur: String(valeur), variation: null, section };
}

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /* LE TYPE DE RETOUR EST CELUI DU CONTRAT PUBLIÉ, et c'est le cœur de la
     reprise : tant qu'il était implicite, le service pouvait rendre ce qu'il
     voulait, et il a rendu autre chose pendant six semaines sans que rien ne
     l'arrête. Écrit ainsi, la divergence ne compile plus. */
  async etat(): Promise<Dashboard> {
    const maintenant = Date.now();

    const delaiLigne = await this.prisma.systemParameter.findUnique({
      where: { key: "account_grace_period_days" },
    });
    const delai = Number(delaiLigne?.value) > 0 ? Number(delaiLigne?.value) : DELAI_DEFAUT;
    const limiteEcheance = new Date(maintenant - delai * JOUR_MS);

    const [actifs, suspendus, enAttente, echues, echecs, aEffacer, demandes] = await Promise.all([
      this.prisma.user.count({ where: { status: "active" } }),
      this.prisma.user.count({ where: { status: "suspended" } }),
      this.prisma.user.count({ where: { status: "pending_deletion" } }),
      this.prisma.user.count({
        where: { status: "pending_deletion", deletionRequestedAt: { lte: limiteEcheance } },
      }),
      this.prisma.loginActivity.count({
        where: { result: "failure", createdAt: { gte: new Date(maintenant - FENETRE_ECHECS_H * 60 * 60_000) } },
      }),
      /* LES LIGNES, pas seulement leur nombre : la file « à traiter » mène à
         chaque élément. Bornées, parce qu'un tableau de bord n'est pas la
         section : au-delà, on y va. */
      this.prisma.user.findMany({
        where: { status: "pending_deletion", deletionRequestedAt: { lte: limiteEcheance } },
        orderBy: { deletionRequestedAt: "asc" },
        take: PLAFOND_FILE,
        select: { id: true, username: true, deletionRequestedAt: true, createdAt: true },
      }),
      this.prisma.supportRequest.findMany({
        where: { status: "open" },
        orderBy: { createdAt: "asc" },
        take: PLAFOND_FILE,
        select: { id: true, subject: true, createdAt: true },
      }),
    ]);

    // Ce qui ne va pas, avant tout chiffre — et rien quand rien ne va mal. Une
    // file vide n'est pas une anomalie : inventer une alerte neutre pour
    // meubler le rang apprendrait à ne plus le regarder.
    const alertes: Alerte[] = [];
    if (echues > 0) {
      alertes.push({
        /* L'identifiant est celui de la CAUSE, pas un tirage : l'écran s'en
           sert de clé de rendu, et un identifiant neuf à chaque appel ferait
           remonter une pastille inchangée à chaque rafraîchissement. */
        id: "suppression_echeance",
        cause: "suppression_echeance",
        libelle: `${echues} suppression${echues > 1 ? "s" : ""} à effacer`,
        ton: "danger",
        section: "suppressions",
      });
    }
    if (echecs >= SEUIL_ECHECS) {
      alertes.push({
        id: "connexions_echouees",
        cause: "connexions_echouees",
        libelle: `${echecs} connexions échouées sur ${FENETRE_ECHECS_H} h`,
        ton: "attention",
        section: "connexions",
      });
    }

    /* LES CHIFFRES, après ce qui ne va pas. Ce sont les mêmes nombres qu'avant
       — ils étaient rendus en grappes (`comptes`, `suppressions`,
       `connexions`) que ni le contrat ni l'écran ne savaient lire. Une carte
       par nombre, avec la section où il s'explique : « chaque chiffre mène à
       la section qui l'explique » (ux-admin §5.2). */
    const indicateurs: Indicateur[] = [
      chiffre("comptes_actifs", "Comptes actifs", actifs, "comptes"),
      chiffre("comptes_suspendus", "Comptes suspendus", suspendus, "comptes"),
      chiffre("suppressions_en_cours", "Suppressions en cours", enAttente, "suppressions"),
      /* Sans section : il n'existe pas d'écran des connexions échouées, et un
         chiffre qui mène nulle part reste une carte plutôt qu'un bouton qui
         promettrait une page absente. */
      chiffre("connexions_echecs", `Connexions échouées (${FENETRE_ECHECS_H} h)`, echecs, null),
    ];

    /* CE QUI ATTEND UNE DÉCISION, ligne par ligne — et non un décompte. « Chaque
       élément à traiter mène directement à la section concernée » : une file
       résumée en un nombre ne mène nulle part, et c'est par ici qu'on entre
       dans le délai de grâce et dans l'assistance, qui n'ont pas d'entrée au
       menu.

       `derniersGestes` disparaît : le journal d'audit a son écran, et le
       tableau de bord porte ce qui attend, pas ce qui est fait. */
    const aTraiter: ATraiter[] = [
      ...aEffacer.map((u) => ({
        id: u.id,
        element: u.username,
        section: "suppressions",
        etat: "Délai échu",
        depuis: (u.deletionRequestedAt ?? u.createdAt).toISOString(),
      })),
      ...demandes.map((d) => ({
        id: d.id,
        /* Le sujet est FACULTATIF côté base : une demande peut n'en porter
           aucun. On nomme alors la file plutôt que de rendre une ligne vide —
           une ligne sans intitulé ne se clique pas, et elle attend pourtant
           une réponse comme les autres. */
        element: d.subject ?? "Demande sans objet",
        section: "assistance",
        etat: "Sans réponse",
        depuis: d.createdAt.toISOString(),
      })),
    ];

    return {
      // Le plafond est tenu ici comme il l'est dans le contrat du back-office :
      // trois pastilles au plus, sur une ligne.
      alertes: alertes.slice(0, PLAFOND_ALERTES),
      indicateurs,
      aTraiter,
    };
  }
}

// L'accueil de l'outil, ouvert au support : « consulter le tableau de bord »
// appartient à l'assistance quotidienne (ux-admin §6).
@Controller("admin/dashboard")
@UseGuards(AdminGuard, RoleGuard)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly service: DashboardService) {}

  @Get()
  etat() {
    return this.service.etat();
  }
}
