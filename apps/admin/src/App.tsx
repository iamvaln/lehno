import { useEffect, useState, type ReactNode } from "react";
import { AdminShell, Sidebar, Topbar } from "./composants/coquille/index.js";
import { EmptyState, Ressource } from "./composants/donnees/index.js";
import { Toast } from "./composants/signaux/index.js";
import { Acces, Assistance, Liens, TableauDeBord, Liste, Detail, Credits, Drapeaux, Edition, Lecture, Modeles, SaisiePaiement, Suppressions, Connexion as EcranConnexion, Profil } from "./pages/index.js";
import type { RequeteComptes } from "./pages/Liste.js";
import { codeConnu, messages, type CleCode, type Langue } from "./i18n/index.js";
import { familles as famillesDuRole, sectionAutorisee } from "./navigation.js";

// Les états se disent en français dans le contrat ; la requête, elle, parle au
// serveur dans les termes de sa base. La traduction est ici, et nulle part
// ailleurs.
/** Une date lisible, dans la langue de l'outil. */
function quand(iso: string, langue: Langue): string {
  return new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Le sélecteur de période, identique pour les deux lectures.
 *
 * Les bornes sont des jours et non des dates : une date figée en état
 * cesserait de vouloir dire « les sept derniers jours » passé minuit.
 */
function periodeFiltre(
  label: string, toutes: string, valeur: string, onChoix: (jours: string) => void,
) {
  return {
    cle: "periode",
    label,
    valeur,
    onChange: (e: { target: { value: string } }) => onChoix(e.target.value),
    options: [
      { value: "0", label: toutes },
      { value: "1", label: "24 h" },
      { value: "7", label: "7 j" },
      { value: "30", label: "30 j" },
      { value: "90", label: "90 j" },
    ],
  };
}

const ETAT_SERVEUR: Record<string, string> = {
  actif: "active",
  suspendu: "suspended",
  suppression_en_cours: "pending_deletion",
  efface: "deleted",
};
import { useRessource } from "./api/hooks.js";
import {
  canauxSchema, catalogueIaSchema, comptesAdminSchema, comptesCollecteSchema, compteDetailSchema, dashboardSchema,
  pageAssistanceSchema, pageContactSchema, pageAttenteSchema, pageRetoursSchema,
  drapeauxAdminSchema, pageAuditSchema, pageComptesSchema, pageMouvementsSchema, pagePaiementsSchema,
  paiementDetailSchema, paliersSchema,
  pageConnexionsSchema, pageSuppressionsSchema, parametresSchema,
  profilAdminSchema,
  type Connexion, type TraceAudit,
} from "@lehno/contracts";
// Les données d'aperçu ne servent qu'à la bande de développement. Un écran
// branché ne s'en approche pas : ce qu'il montre vient du serveur ou n'est pas
// montré du tout.
import { demandeCodeReponseSchema, sessionAdminSchema, type AdminRole } from "@lehno/contracts";
import { creerClient, ErreurApi } from "./api/client.js";
import { baseApi, magasinAvecMemoire } from "./api/session.js";

// La surcharge du back-office tient à une classe sur <body> : index.html la pose
// pour l'application servie, cet effet la pose pour tout autre hôte — un test, un
// aperçu de composant. Sans elle, l'outil hérite de la densité du produit.
function useClasseAdmin(nuit: boolean): void {
  useEffect(() => {
    document.body.classList.add("lehno-admin");
    document.body.classList.toggle("lehno-nuit", nuit);
    try {
      localStorage.setItem(CLE_THEME, nuit ? "dark" : "light");
    } catch {
      // Stockage refusé : le thème tient pour la visite, et c'est tout ce qu'on promet.
    }
  }, [nuit]);
}

const CLE_THEME = "lehno.theme";

// Le choix retenu l'emporte sur la préférence du système ; sans choix, on suit
// le système. Un outil qu'on ouvre vingt fois par jour ne se rebascule pas
// vingt fois. La clé est celle du produit : un même poste, un même thème.
function themeInitial(): boolean {
  try {
    const choix = localStorage.getItem(CLE_THEME);
    if (choix === "dark") return true;
    if (choix === "light") return false;
  } catch {
    // Stockage inaccessible : on retombe sur la préférence du navigateur.
  }
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}


const ICONES: Record<string, string> = {
  tableau: "layout-dashboard", alertes: "triangle-alert", moderation: "shield",
  suppressions: "user-minus", contact: "mail", attente: "hourglass",
  transactions: "receipt", comptes: "users", credits: "receipt",
  acces: "user-cog", parametres: "sliders-horizontal",
  fonctionnalites: "toggle-right", modeles: "brain", studio: "image",
  offres: "gift", metriques: "chart-column", audit: "scroll-text",
  connexions: "key-round", liens: "external-link",
};

// Les sections qu'un délai court presse portent un point, jamais un chiffre :
// la barre latérale ne compte pas, les nombres vivent au tableau de bord.
// Seules des entrées de menu peuvent s'allumer : ce jeu n'est consulté que pour
// elles, et une section absente du menu n'y gagnerait rien.
const PRESSEES = new Set(["moderation", "suppressions"]);

/**
 * Les sections encore à livrer, et le gabarit que chacune emploiera.
 *
 * Exactement celles que le menu offre sans qu'un écran les rende : une entrée
 * de trop y affirmerait qu'une section livrée reste à venir, une entrée
 * manquante ferait annoncer « Gabarit : » suivi de rien. Les deux se voient
 * dans `sections-atteignables.test.tsx`, qui ouvre chaque entrée du menu.
 *
 * Le gabarit se lit de la spécification, il ne se devine pas : le studio règle
 * une configuration (§5.9), les offres se listent puis se détaillent (§5.10).
 */
const GABARITS: Record<string, string> = {
  moderation: "liste", studio: "formulaire", offres: "liste",
  metriques: "tableau",
};

// Le nom de la marque ne se traduit pas et ne se remplace pas par le nom de
// l'outil : c'est « Lehno » dans les deux langues (ton et écriture §6). Il ne
// vient donc pas du dictionnaire, à la différence de tout le reste.
const MARQUE = "Lehno";

// Hors de l'outil, et hors de la construction de production : la bascule de rôle
// n'est pas un contrôle du produit — c'est le serveur qui décide d'un rôle, et un
// bandeau qui laisse choisir le sien n'a rien à faire dans un outil livré. Elle ne
// sert qu'à regarder les deux interfaces pendant qu'on les écrit, d'où le garde
// « import.meta.env.DEV » : Vite l'évalue à la compilation et la bande disparaît
// du paquet, code compris.
function BandeApercu(
  { t, role, setRole, connecte, setConnecte }:
  {
    t: ReturnType<typeof messages>; role: AdminRole; setRole: (r: AdminRole) => void;
    connecte: boolean; setConnecte: (c: boolean) => void;
  },
): ReactNode {
  return (
    <div className="apercu-bande">
      <span className="apercu-mention">Aperçu — back-office</span>
      <button type="button" onClick={() => setConnecte(false)} aria-pressed={!connecte}>{t.connexion.titre}</button>
      <button type="button" onClick={() => setConnecte(true)} aria-pressed={connecte}>{t.outil.marque}</button>
      <span className="apercu-separateur" aria-hidden="true" />
      <button type="button" onClick={() => setRole("support")} aria-pressed={role === "support"}>{t.barre.roleSupport}</button>
      <button type="button" onClick={() => setRole("admin")} aria-pressed={role === "admin"}>{t.barre.roleAdmin}</button>
    </div>
  );
}

// Le client se crée une fois, hors du composant : il porte la session, et une
// instance par rendu perdrait le jeton rafraîchi entre deux appels.
const api = creerClient({ base: baseApi(), magasin: magasinAvecMemoire() });

export function App(): ReactNode {
  const [langue, setLangue] = useState<Langue>("fr");
  const [nuit, setNuit] = useState(themeInitial);
  // Le rôle n'est plus un état qu'on choisit : c'est ce que le serveur a
  // répondu. La bande d'aperçu peut encore le basculer en développement, mais
  // elle ne décide de rien — le serveur refuse par ailleurs.
  const [role, setRole] = useState<AdminRole>(() => api.session()?.role ?? "support");
  const [section, setSection] = useState("tableau");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [navOuverte, setNavOuverte] = useState(false);
  const [connecte, setConnecte] = useState(() => api.session() !== null);

  useClasseAdmin(nuit);
  const t = messages(langue);

  // Le titre du document suit la langue de l'outil : un onglet parmi vingt se
  // retrouve à son nom.
  useEffect(() => {
    document.title = t.outil.titre;
  }, [t]);

  // Fermer la session côté serveur avant de rendre l'écran de connexion : un
  // jeton de rafraîchissement qu'on abandonne sans le révoquer reste valable
  // douze heures pour qui l'aurait copié.
  async function deconnecter(): Promise<void> {
    const session = api.session();
    try {
      if (session) {
        await api.appeler("/admin/auth/session", {
          methode: "DELETE",
          corps: { refreshToken: session.rafraichissement },
        });
      }
    } catch {
      // Le serveur est injoignable : on ferme quand même de ce côté-ci plutôt
      // que de laisser l'outil ouvert. Le jeton expirera de lui-même.
    } finally {
      api.fermer();
      setConnecte(false);
    }
  }

  const aller = (id: string): void => {
    // Changer de section repart de la première page : garder le curseur du
    // journal en ouvrant les connexions demanderait au serveur une page qui
    // n'existe pas dans cette table.
    setCurseursLecture([null]);
    // Changer de section referme le paiement ouvert : y revenir plus tard
    // rouvrirait une fiche qu'on n'a pas demandée.
    setPaiementOuvert(null);
    setSaisieOuverte(false);
    // Cacher l'entrée ne suffit pas : un raccourci du tableau de bord, une
    // adresse gardée en mémoire ou un retour arrière y mèneraient encore. Une
    // section hors des droits ramène au tableau de bord (ux-admin §5.1).
    setSection(sectionAutorisee(role, id) ? id : "tableau");
    setOuvert(null);
    setNavOuverte(false);
  };

  const familles = famillesDuRole(role).map(({ famille, items }) => ({
    titre: famille ? t.familles[famille] : "",
    items: items.map((id) => ({
      id,
      label: t.sections[id as keyof typeof t.sections],
      icon: ICONES[id] ?? "circle",
      ...(PRESSEES.has(id) ? { ton: "alerte" as const } : {}),
    })),
  }));

  // Appelé sans condition, comme tout hook : le placer derrière le « if » de la
  // section changerait l'ordre des hooks d'un rendu à l'autre. Il ne charge que
  // lorsque la section le demande — c'est la clé qui le décide.
  const etatTableau = useRessource(
    () => (section === "tableau"
      ? api.appeler("/admin/dashboard", { schema: dashboardSchema })
      : Promise.resolve(null)),
    [section],
  );

  // La requête courante de la liste, et la pile des curseurs déjà franchis.
  // Une API à curseur ne sait pas revenir en arrière : c'est l'appelant qui
  // garde le chemin parcouru, sinon « Précédent » n'existe pas.
  const [requeteComptes, setRequeteComptes] = useState<RequeteComptes>({});
  const [curseurs, setCurseurs] = useState<(string | null)[]>([null]);
  // Après écriture, on relit : le serveur renvoie la valeur précédente calculée
  // depuis le journal, et c'est lui qui fait foi — pas ce qu'on croit avoir
  // écrit.
  const [tourParametres, setTourParametres] = useState(0);
  const [tourSuppressions, setTourSuppressions] = useState(0);
  const [tourModeles, setTourModeles] = useState(0);
  const [tourDrapeaux, setTourDrapeaux] = useState(0);
  const [tourCredits, setTourCredits] = useState(0);
  const [tourAcces, setTourAcces] = useState(0);
  const [tourProfil, setTourProfil] = useState(0);
  const [tourAssistance, setTourAssistance] = useState(0);
  const [ongletAssistance, setOngletAssistance] = useState<"demandes" | "contact" | "attente" | "retours">("demandes");
  const [filtreAssistance, setFiltreAssistance] = useState("tous");
  const [ongletCredits, setOngletCredits] = useState<"paiements" | "mouvements" | "reglages">("paiements");
  const [filtresPaiements, setFiltresPaiements] = useState<{ etat: string; mode: string }>({ etat: "tous", mode: "tous" });
  const [paiementOuvert, setPaiementOuvert] = useState<string | null>(null);
  const [saisieOuverte, setSaisieOuverte] = useState(false);
  // Le refus d'une écriture se dit à l'écran, traduit depuis son code.
  const [avis, setAvis] = useState<CleCode | null>(null);
  const [avisExport, setAvisExport] = useState<string | null>(null);
  const [curseursLecture, setCurseursLecture] = useState<(string | null)[]>([null]);
  const [filtresJournal, setFiltresJournal] = useState<{ action: string; jours: string }>({ action: "toutes", jours: "0" });
  const [filtresEntrees, setFiltresEntrees] = useState<{ resultat: string; jours: string }>({ resultat: "tous", jours: "0" });
  const [exportEnCours, setExportEnCours] = useState(false);
  const curseurLecture = curseursLecture.at(-1) ?? null;

  // Les deux gestes du délai de grâce sont des changements d'état de compte, et
  // passent par le seul chemin qui en porte un — motif obligatoire, règle de
  // rôle, journal. Un second chemin d'écriture finirait par diverger du
  // premier : l'un journalisant, l'autre non.
  // Les trois gestes sur un compte d'exploitation passent par le même chemin :
  // ils partagent la traduction du refus et la relecture qui suit.
  const ecrireAcces = (chemin: string, methode: "POST" | "PATCH" | "DELETE", corps: unknown): void => {
    void (async () => {
      try {
        await api.appeler(chemin, { methode, corps });
      } catch (echec) {
        if (echec instanceof ErreurApi) setAvis(codeConnu(echec.code));
      } finally {
        // On relit dans tous les cas : après un refus, la liste affichée est
        // celle d'avant, et c'est elle qui fait foi.
        setTourAcces((n) => n + 1);
      }
    })();
  };

  const changerEtat = (id: string, statut: string, motif: string): void => {
    void (async () => {
      try {
        await api.appeler(`/admin/users/${id}`, {
          methode: "PATCH",
          corps: { status: statut, reason: motif },
        });
      } finally {
        // On relit dans tous les cas : après un refus, la file affichée est
        // celle d'avant, et c'est elle qui fait foi.
        setTourSuppressions((n) => n + 1);
      }
    })();
  };
  const curseur = curseurs.at(-1) ?? null;

  const etatComptes = useRessource(
    () => (section === "comptes" && !ouvert
      ? api.appeler("/admin/users", {
        schema: pageComptesSchema,
        requete: {
          ...(requeteComptes.q ? { q: requeteComptes.q } : {}),
          ...(requeteComptes.etat && requeteComptes.etat !== "tous"
            ? { status: ETAT_SERVEUR[requeteComptes.etat] }
            : {}),
          ...(requeteComptes.limit ? { limit: String(requeteComptes.limit) } : {}),
          ...(curseur ? { cursor: curseur } : {}),
        },
      })
      : Promise.resolve(null)),
    [section, ouvert, requeteComptes.q, requeteComptes.etat, requeteComptes.limit, curseur],
    { garderAncien: true },
  );

  const etatFiche = useRessource(
    () => (section === "comptes" && ouvert
      ? api.appeler(`/admin/users/${ouvert}`, { schema: compteDetailSchema })
      : Promise.resolve(null)),
    [section, ouvert],
  );

  const etatParametres = useRessource(
    () => (section === "parametres"
      ? api.appeler("/admin/parameters", { schema: parametresSchema })
      : Promise.resolve(null)),
    [section, tourParametres],
  );

  const etatSuppressions = useRessource(
    () => (section === "suppressions"
      ? api.appeler("/admin/deletions", { schema: pageSuppressionsSchema })
      : Promise.resolve(null)),
    [section, tourSuppressions],
  );

  // Les deux lectures partagent leur pile de curseurs : on n'en regarde qu'une
  // à la fois, et changer de section en repart de la première page.
  // Une période se dit en jours, et se traduit en date au dernier moment :
  // garder une date en état la figerait au chargement de la page, et « les sept
  // derniers jours » cesserait de vouloir dire ça passé minuit.
  const depuis = (jours: string): Record<string, string> =>
    jours === "0" ? {} : { since: new Date(Date.now() - Number(jours) * 86_400_000).toISOString() };

  const requeteJournal = {
    ...(filtresJournal.action !== "toutes" ? { action: filtresJournal.action } : {}),
    ...depuis(filtresJournal.jours),
  };
  const requeteEntrees = {
    ...(filtresEntrees.resultat !== "tous" ? { result: filtresEntrees.resultat } : {}),
    ...depuis(filtresEntrees.jours),
  };

  /**
   * Sortir un fichier et le remettre au navigateur.
   *
   * Le contenu passe par le client d'API pour porter le jeton : un lien nu ne
   * peut pas l'emporter, et c'est pour ça que l'export est un appel plutôt
   * qu'une adresse qu'on ouvre.
   */
  const exporter = (chemin: string, requete: Record<string, string>, fichier: string): void => {
    void (async () => {
      setExportEnCours(true);
      try {
        const csv = await api.appelerTexte(chemin, { methode: "POST", requete });
        const lien = document.createElement("a");
        lien.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        lien.download = fichier;
        lien.click();
        URL.revokeObjectURL(lien.href);
        setAvisExport(t.exporter.telecharge);
      } catch (echec) {
        // Un export refusé se dit : sans ça, on croirait le fichier parti.
        if (echec instanceof ErreurApi) setAvis(codeConnu(echec.code));
      } finally {
        setExportEnCours(false);
      }
    })();
  };

  const etatAudit = useRessource(
    () => (section === "audit"
      ? api.appeler("/admin/audit-log", {
        schema: pageAuditSchema,
        requete: { ...requeteJournal, ...(curseurLecture ? { cursor: curseurLecture } : {}) },
      })
      : Promise.resolve(null)),
    [section, curseurLecture, filtresJournal.action, filtresJournal.jours],
    { garderAncien: true },
  );

  const etatConnexions = useRessource(
    () => (section === "connexions"
      ? api.appeler("/admin/login-activity", {
        schema: pageConnexionsSchema,
        requete: { ...requeteEntrees, ...(curseurLecture ? { cursor: curseurLecture } : {}) },
      })
      : Promise.resolve(null)),
    [section, curseurLecture, filtresEntrees.resultat, filtresEntrees.jours],
    { garderAncien: true },
  );

  const etatModeles = useRessource(
    () => (section === "modeles"
      ? api.appeler("/admin/ai-models", { schema: catalogueIaSchema })
      : Promise.resolve(null)),
    [section, tourModeles],
  );

  const etatDrapeaux = useRessource(
    () => (section === "fonctionnalites"
      ? api.appeler("/admin/feature-flags", { schema: drapeauxAdminSchema })
      : Promise.resolve(null)),
    [section, tourDrapeaux],
  );

  const surCredits = section === "credits";
  const requetePaiements = {
    ...(filtresPaiements.etat !== "tous" ? { etat: filtresPaiements.etat } : {}),
    ...(filtresPaiements.mode !== "tous" ? { mode: filtresPaiements.mode } : {}),
  };

  const etatPaiements = useRessource(
    () => (surCredits && ongletCredits === "paiements" && !paiementOuvert
      ? api.appeler("/admin/payments", { schema: pagePaiementsSchema, requete: requetePaiements })
      : Promise.resolve(null)),
    [surCredits, ongletCredits, paiementOuvert, filtresPaiements.etat, filtresPaiements.mode, tourCredits],
    { garderAncien: true },
  );

  const etatPaiement = useRessource(
    () => (surCredits && paiementOuvert
      ? api.appeler(`/admin/payments/${paiementOuvert}`, { schema: paiementDetailSchema })
      : Promise.resolve(null)),
    [surCredits, paiementOuvert, tourCredits],
  );

  // Quatre listes pour un seul formulaire : les charger ensemble évite quatre
  // états d'attente sur un écran qui n'en montre qu'un.
  const etatSaisie = useRessource(
    async () => (surCredits && saisieOuverte
      ? {
        comptes: await api.appeler("/admin/users", { schema: pageComptesSchema, requete: { limit: "200" } }),
        paliers: await api.appeler("/admin/credit-bundles", { schema: paliersSchema }),
        canaux: await api.appeler("/admin/payment-channels", { schema: canauxSchema }),
        collecte: await api.appeler("/admin/collection-accounts", { schema: comptesCollecteSchema }),
      }
      : null),
    [surCredits, saisieOuverte],
  );

  const etatMouvements = useRessource(
    () => (surCredits && ongletCredits === "mouvements"
      ? api.appeler("/admin/credit-transactions", { schema: pageMouvementsSchema })
      : Promise.resolve(null)),
    [surCredits, ongletCredits, tourCredits],
  );

  // Les trois tables se lisent ensemble : l'onglet des réglages les montre
  // côte à côte, et les séparer ferait trois états d'attente sur un seul écran.
  const etatReglages = useRessource(
    async () => (surCredits && ongletCredits === "reglages"
      ? {
        paliers: await api.appeler("/admin/credit-bundles", { schema: paliersSchema }),
        canaux: await api.appeler("/admin/payment-channels", { schema: canauxSchema }),
        comptes: await api.appeler("/admin/collection-accounts", { schema: comptesCollecteSchema }),
      }
      : null),
    [surCredits, ongletCredits, tourCredits],
  );

  const surAssistance = section === "assistance";

  // Une ressource par onglet plutôt qu'un chargement des quatre : on n'en
  // regarde qu'une à la fois, et les charger ensemble ferait payer trois
  // lectures pour une.
  const etatDemandes = useRessource(
    () => (surAssistance && ongletAssistance === "demandes"
      ? api.appeler("/admin/support-requests", {
        schema: pageAssistanceSchema,
        requete: filtreAssistance === "tous" ? {} : { etat: filtreAssistance },
      })
      : Promise.resolve(null)),
    [surAssistance, ongletAssistance, filtreAssistance, tourAssistance],
    { garderAncien: true },
  );

  const etatContact = useRessource(
    () => (surAssistance && ongletAssistance === "contact"
      ? api.appeler("/admin/contact-messages", { schema: pageContactSchema })
      : Promise.resolve(null)),
    [surAssistance, ongletAssistance],
  );

  const etatAttente = useRessource(
    () => (surAssistance && ongletAssistance === "attente"
      ? api.appeler("/admin/waitlist", { schema: pageAttenteSchema })
      : Promise.resolve(null)),
    [surAssistance, ongletAssistance],
  );

  const etatRetours = useRessource(
    () => (surAssistance && ongletAssistance === "retours"
      ? api.appeler("/admin/feedback", { schema: pageRetoursSchema })
      : Promise.resolve(null)),
    [surAssistance, ongletAssistance],
  );

  const etatAcces = useRessource(
    () => (section === "acces"
      ? api.appeler("/admin/admins", { schema: comptesAdminSchema })
      : Promise.resolve(null)),
    [section, tourAcces],
  );

  const etatProfil = useRessource(
    () => (section === "profil"
      ? api.appeler("/admin/me", { schema: profilAdminSchema })
      : Promise.resolve(null)),
    [section, tourProfil],
  );

  let vue: ReactNode;
  if (section === "profil") {
    vue = (
      <Ressource
        etat={etatProfil}
        t={t}
        enfant={(moi) => (moi ? (
          <Profil
            profil={moi}
            langue={langue}
            // La page retire les lignes fermées de ce qu'elle montre ; on relit
            // quand même, pour que ce qui reste vienne du serveur et non d'une
            // soustraction faite de notre côté.
            onFermerSessions={() => {
              void (async () => {
                try {
                  await api.appeler("/admin/me/sessions", { methode: "DELETE" });
                } catch (echec) {
                  if (echec instanceof ErreurApi) setAvis(codeConnu(echec.code));
                } finally {
                  setTourProfil((n) => n + 1);
                }
              })();
            }}
          />
        ) : null)}
      />
    );
  } else if (section === "comptes" && ouvert) {
    vue = (
      <Ressource
        etat={etatFiche}
        t={t}
        enfant={(compte) => (compte ? (
          <Detail
            role={role}
            langue={langue}
            compte={compte}
            // Vide tant qu'aucun point d'entrée ne rend l'historique d'un
            // compte : un pied de page vide dit ce qui est, la fixture qui
            // était passée ici disait le contraire.
            onRetour={() => setOuvert(null)}
          />
        ) : null)}
      />
    );
  } else if (section === "credits" && saisieOuverte) {
    vue = (
      <Ressource
        etat={etatSaisie}
        t={t}
        enfant={(donnees) => (donnees ? (
          <SaisiePaiement
            langue={langue}
            comptes={donnees.comptes.items}
            paliers={donnees.paliers.items}
            canaux={donnees.canaux.items}
            comptesCollecte={donnees.collecte.items}
            onAnnuler={() => setSaisieOuverte(false)}
            onEnregistrer={(saisie) => {
              void (async () => {
                try {
                  await api.appeler("/admin/payments", { methode: "POST", corps: saisie });
                  setSaisieOuverte(false);
                  setAvisExport(t.credits.saisie.enregistre);
                } catch (echec) {
                  // Un palier devenu inactif entre-temps, par exemple : le
                  // refus se traduit plutôt que de laisser croire à une panne.
                  if (echec instanceof ErreurApi) setAvis(codeConnu(echec.code));
                } finally {
                  setTourCredits((n) => n + 1);
                }
              })();
            }}
          />
        ) : null)}
      />
    );
  } else if (section === "credits" && paiementOuvert) {
    vue = (
      <Ressource
        etat={etatPaiement}
        t={t}
        enfant={(detail) => (detail ? (
          <Credits
            role={role}
            langue={langue}
            paiement={detail}
            onRetour={(id) => {
              setPaiementOuvert(null);
              if (id !== "credits") aller(id);
            }}
            onDecider={(decision) => {
              void (async () => {
                try {
                  await api.appeler(`/admin/payments/${paiementOuvert}/decision`, {
                    methode: "POST", corps: decision,
                  });
                } catch (echec) {
                  if (echec instanceof ErreurApi) setAvis(codeConnu(echec.code));
                } finally {
                  // On relit dans tous les cas : après un refus, l'état affiché
                  // est celui d'avant, et c'est lui qui fait foi.
                  setTourCredits((n) => n + 1);
                }
              })();
            }}
          />
        ) : null)}
      />
    );
  } else if (section === "credits") {
    // Une enveloppe par onglet plutôt qu'une union : les trois ressources n'ont
    // pas la même forme, et les faire passer par un seul canal obligerait à
    // deviner laquelle on tient à chaque lecture.
    const commun = {
      role,
      langue,
      onglet: ongletCredits,
      onOnglet: setOngletCredits,
      filtreEtat: filtresPaiements.etat,
      filtreMode: filtresPaiements.mode,
      onFiltre: (f: { etat?: string; mode?: string }) =>
        setFiltresPaiements((courant) => ({ ...courant, ...f })),
      onRetour: aller,
    };

    if (ongletCredits === "mouvements") {
      vue = (
        <Ressource
          etat={etatMouvements}
          t={t}
          enfant={(page) => <Credits {...commun} mouvements={page?.items ?? []} />}
        />
      );
    } else if (ongletCredits === "reglages") {
      vue = (
        <Ressource
          etat={etatReglages}
          t={t}
          enfant={(tables) => (
            <Credits
              {...commun}
              paliers={tables?.paliers.items ?? []}
              canaux={tables?.canaux.items ?? []}
              comptes={tables?.comptes.items ?? []}
            />
          )}
        />
      );
    } else {
      vue = (
        <Ressource
          etat={etatPaiements}
          t={t}
          enfant={(page) => (
            <Credits
              {...commun}
              paiements={page?.items ?? []}
              onOuvrir={(p) => setPaiementOuvert(p.id)}
              {...(role === "admin" ? { onSaisir: () => setSaisieOuverte(true) } : {})}
            />
          )}
        />
      );
    }
  } else if (section === "assistance") {
    const communAssistance = {
      langue,
      onglet: ongletAssistance,
      onOnglet: setOngletAssistance,
      filtreEtat: filtreAssistance,
      onFiltre: setFiltreAssistance,
      onRetour: aller,
      onSolder: (id: string, etat: "open" | "answered" | "closed", reason: string) => {
        void (async () => {
          try {
            await api.appeler(`/admin/support-requests/${id}`, {
              methode: "PATCH", corps: { etat, reason },
            });
          } catch (echec) {
            if (echec instanceof ErreurApi) setAvis(codeConnu(echec.code));
          } finally {
            setTourAssistance((n) => n + 1);
          }
        })();
      },
    };

    if (ongletAssistance === "contact") {
      vue = (
        <Ressource etat={etatContact} t={t}
          enfant={(page) => <Assistance {...communAssistance} contact={page?.items ?? []} />} />
      );
    } else if (ongletAssistance === "attente") {
      vue = (
        <Ressource etat={etatAttente} t={t}
          enfant={(page) => <Assistance {...communAssistance} attente={page?.items ?? []} />} />
      );
    } else if (ongletAssistance === "retours") {
      vue = (
        <Ressource etat={etatRetours} t={t}
          enfant={(page) => <Assistance {...communAssistance} retours={page?.items ?? []} />} />
      );
    } else {
      vue = (
        <Ressource etat={etatDemandes} t={t}
          enfant={(page) => <Assistance {...communAssistance} demandes={page?.items ?? []} />} />
      );
    }
  } else if (section === "liens") {
    // Aucun appel : la page rend un registre du code. Pas d'état de chargement
    // à tenir, donc pas de `Ressource` — l'envelopper en inventerait un.
    vue = <Liens langue={langue} onRetour={aller} />;
  } else if (section === "acces") {
    vue = (
      <Ressource
        etat={etatAcces}
        t={t}
        enfant={(page) => (page ? (
          <Acces
            langue={langue}
            // Le compte de celui qui regarde : on ne touche ni à son rôle ni à
            // son accès, et le serveur refuse les deux.
            moiId={page.items.find((a) => a.email === api.session()?.email)?.id ?? ""}
            comptes={page.items}
            onInviter={(invitation) => ecrireAcces("/admin/admins", "POST", invitation)}
            onChangerRole={(id, role, reason) => ecrireAcces(`/admin/admins/${id}`, "PATCH", { role, reason })}
            onRevoquer={(id, reason) => ecrireAcces(`/admin/admins/${id}`, "DELETE", { reason })}
            onRetour={aller}
          />
        ) : null)}
      />
    );
  } else if (section === "fonctionnalites") {
    vue = (
      <Ressource
        etat={etatDrapeaux}
        t={t}
        enfant={(registre) => (registre ? (
          <Drapeaux
            role={role}
            langue={langue}
            drapeaux={registre.items}
            onBasculer={(drapeau, actif, motif) => {
              void (async () => {
                try {
                  await api.appeler("/admin/feature-flags", {
                    methode: "PATCH",
                    corps: { cle: drapeau.cle, actif, reason: motif },
                  });
                } catch (echec) {
                  if (echec instanceof ErreurApi) setAvis(codeConnu(echec.code));
                } finally {
                  // On relit dans tous les cas : après un refus, l'état affiché
                  // est celui d'avant, et c'est lui qui fait foi.
                  setTourDrapeaux((n) => n + 1);
                }
              })();
            }}
            onRetour={aller}
          />
        ) : null)}
      />
    );
  } else if (section === "modeles") {
    vue = (
      <Ressource
        etat={etatModeles}
        t={t}
        enfant={(catalogue) => (catalogue ? (
          <Modeles
            role={role}
            langue={langue}
            modeles={catalogue.items}
            onBasculer={(modele, actif, motif) => {
              void (async () => {
                try {
                  await api.appeler("/admin/ai-models", {
                    methode: "PATCH",
                    corps: { id: modele.id, enabled: actif, reason: motif },
                  });
                } catch (echec) {
                  // Le serveur refuse d'éteindre le dernier modèle en service :
                  // couper toute génération sans que rien ne le dise avant la
                  // première panne. L'écran traduit ce refus plutôt que de
                  // laisser croire à une panne de l'outil.
                  if (echec instanceof ErreurApi) setAvis(codeConnu(echec.code));
                } finally {
                  setTourModeles((n) => n + 1);
                }
              })();
            }}
            onRetour={aller}
          />
        ) : null)}
      />
    );
  } else if (section === "audit") {
    vue = (
      <Ressource
        etat={etatAudit}
        t={t}
        enfant={(page) => (page ? (
          <Lecture<TraceAudit>
            langue={langue}
            titre={t.journal.titre}
            sous={t.journal.sous}
            lignes={page.items}
            vide={t.journal.vide}
            colonnes={[
              { cle: "date", titre: t.journal.col.date, largeur: 190, rendu: (l) => quand(l.date, langue) },
              { cle: "acteurType", titre: t.journal.col.acteur, largeur: 150, rendu: (l) => t.journal.acteurs[l.acteurType] },
              { cle: "action", titre: t.journal.col.action },
              {
                cle: "motif",
                titre: t.journal.col.motif,
                // L'absence se dit. Une case vide se lirait comme un oubli,
                // alors qu'un utilisateur agissant chez lui n'a rien à
                // justifier.
                rendu: (l) => l.motif ?? t.journal.sansMotif,
              },
              { cle: "cibleType", titre: t.journal.col.cible, discret: true, rendu: (l) => l.cibleType ?? t.entrees.inconnu },
            ]}
            curseurSuivant={page.nextCursor}
            aPrecedent={curseursLecture.length > 1}
            onPageSuivante={() => {
              if (page.nextCursor) setCurseursLecture((c) => [...c, page.nextCursor]);
            }}
            onPagePrecedente={() => setCurseursLecture((c) => (c.length > 1 ? c.slice(0, -1) : c))}
            onRetour={aller}
            filtres={[
              {
                cle: "action",
                label: t.journal.filtres.action,
                valeur: filtresJournal.action,
                onChange: (e) => {
                  setFiltresJournal((f) => ({ ...f, action: e.target.value }));
                  // Toute nouvelle question repart de la première page.
                  setCurseursLecture([null]);
                },
                options: [
                  { value: "toutes", label: t.journal.filtres.toutes },
                  ...Object.entries(t.journal.filtres.actions).map(([value, label]) => ({ value, label })),
                ],
              },
              periodeFiltre(t.journal.filtres.periode, t.journal.filtres.touteLaPeriode, filtresJournal.jours, (jours) => {
                setFiltresJournal((f) => ({ ...f, jours }));
                setCurseursLecture([null]);
              }),
            ]}
            {...(filtresJournal.action !== "toutes" || filtresJournal.jours !== "0"
              ? {
                onReinitialiser: () => {
                  setFiltresJournal({ action: "toutes", jours: "0" });
                  setCurseursLecture([null]);
                },
              }
              : {})}
            onExporter={() => exporter("/admin/audit-log/export", requeteJournal, "journal-audit.csv")}
            exportEnCours={exportEnCours}
          />
        ) : null)}
      />
    );
  } else if (section === "connexions") {
    vue = (
      <Ressource
        etat={etatConnexions}
        t={t}
        enfant={(page) => (page ? (
          <Lecture<Connexion>
            langue={langue}
            titre={t.entrees.titre}
            sous={t.entrees.sous}
            lignes={page.items}
            vide={t.entrees.vide}
            colonnes={[
              { cle: "date", titre: t.entrees.col.date, largeur: 190, rendu: (l) => quand(l.date, langue) },
              { cle: "compte", titre: t.entrees.col.compte, rendu: (l) => l.compte ?? t.entrees.inconnu },
              // C'est elle qui montre qu'on essaie mille adresses à la suite :
              // la masquer faute de compte cacherait ce qu'on vient regarder.
              { cle: "adresseTentee", titre: t.entrees.col.adresse, rendu: (l) => l.adresseTentee ?? t.entrees.inconnu },
              { cle: "resultat", titre: t.entrees.col.resultat, largeur: 130, rendu: (l) => t.entrees.resultats[l.resultat] },
              { cle: "appareil", titre: t.entrees.col.appareil, discret: true, rendu: (l) => l.appareil ?? t.entrees.inconnu },
              { cle: "lieu", titre: t.entrees.col.lieu, discret: true, rendu: (l) => l.lieu ?? t.entrees.inconnu },
            ]}
            curseurSuivant={page.nextCursor}
            aPrecedent={curseursLecture.length > 1}
            onPageSuivante={() => {
              if (page.nextCursor) setCurseursLecture((c) => [...c, page.nextCursor]);
            }}
            onPagePrecedente={() => setCurseursLecture((c) => (c.length > 1 ? c.slice(0, -1) : c))}
            onRetour={aller}
            filtres={[
              {
                cle: "resultat",
                label: t.entrees.filtres.resultat,
                valeur: filtresEntrees.resultat,
                onChange: (e) => {
                  setFiltresEntrees((f) => ({ ...f, resultat: e.target.value }));
                  setCurseursLecture([null]);
                },
                options: [
                  { value: "tous", label: t.entrees.filtres.tous },
                  { value: "success", label: t.entrees.resultats.success },
                  { value: "failure", label: t.entrees.resultats.failure },
                ],
              },
              periodeFiltre(t.entrees.filtres.periode, t.entrees.filtres.touteLaPeriode, filtresEntrees.jours, (jours) => {
                setFiltresEntrees((f) => ({ ...f, jours }));
                setCurseursLecture([null]);
              }),
            ]}
            {...(filtresEntrees.resultat !== "tous" || filtresEntrees.jours !== "0"
              ? {
                onReinitialiser: () => {
                  setFiltresEntrees({ resultat: "tous", jours: "0" });
                  setCurseursLecture([null]);
                },
              }
              : {})}
            onExporter={() => exporter("/admin/login-activity/export", requeteEntrees, "connexions.csv")}
            exportEnCours={exportEnCours}
          />
        ) : null)}
      />
    );
  } else if (section === "tableau") {
    vue = (
      <Ressource
        etat={etatTableau}
        t={t}
        enfant={(donnees) => (
          donnees ? <TableauDeBord donnees={donnees} t={t} onAller={aller} /> : null
        )}
      />
    );
  } else if (section === "comptes") {
    vue = (
      <Ressource
        etat={etatComptes}
        t={t}
        enfant={(page) => (page ? (
          <Liste
            role={role}
            langue={langue}
            comptes={page.items}
            onOuvrir={(c) => setOuvert(c.id)}
            onRequete={(requete) => {
              // Toute nouvelle question repart de la première page : garder le
              // curseur ferait chercher « awa » à partir du centième compte.
              setRequeteComptes(requete);
              setCurseurs([null]);
            }}
            curseurSuivant={page.nextCursor}
            aPrecedent={curseurs.length > 1}
            onPageSuivante={() => {
              if (page.nextCursor) setCurseurs((c) => [...c, page.nextCursor]);
            }}
            onPagePrecedente={() => setCurseurs((c) => (c.length > 1 ? c.slice(0, -1) : c))}
          />
        ) : null)}
      />
    );
  } else if (section === "parametres") {
    vue = (
      <Ressource
        etat={etatParametres}
        t={t}
        enfant={(reglages) => (reglages ? (
          <Edition
            role={role}
            langue={langue}
            parametres={reglages}
            onEnregistrer={(valeurs, motif) => {
              void (async () => {
                // Un paramètre à la fois : le serveur écrit et journalise chaque
                // clé dans sa propre transaction, et une écriture refusée ne
                // doit pas entraîner celles qui ont abouti.
                for (const parametre of valeurs.economie) {
                  const avant = reglages.economie.find((p) => p.cle === parametre.cle);
                  if (!avant || String(avant.valeur) === String(parametre.valeur)) continue;
                  await api.appeler("/admin/parameters", {
                    methode: "PATCH",
                    corps: { key: parametre.cle, value: String(parametre.valeur), reason: motif },
                  });
                }
                setTourParametres((n) => n + 1);
              })();
            }}
            onRetour={(id) => aller(id ?? "tableau")}
          />
        ) : null)}
      />
    );
  } else if (section === "suppressions") {
    vue = (
      <Ressource
        etat={etatSuppressions}
        t={t}
        enfant={(file) => (file ? (
          <Suppressions
            role={role}
            langue={langue}
            demandes={file.items}
            onRestaurer={(demande, motif) => changerEtat(demande.id, "active", motif)}
            onEffacer={(demande, motif) => changerEtat(demande.id, "deleted", motif)}
          />
        ) : null)}
      />
    );
  } else {
    // Le repli attrape toute section sans écran, y compris une que le tableau de
    // bord désignerait sans qu'on l'ait prévue. On n'annonce donc le gabarit que
    // lorsqu'on le connaît : « Gabarit : » suivi de rien n'est pas une annonce.
    const nomDuGabarit = t.gabarits[GABARITS[section] as keyof typeof t.gabarits];
    vue = (
      <EmptyState
        titre={t.attente.titre}
        texte={nomDuGabarit
          ? `${t.attente.texte} ${t.attente.gabarit.replace("{gabarit}", nomDuGabarit)}`
          : t.attente.texte}
      />
    );
  }

  // La connexion vit hors de la coquille : ni navigation, ni barre haute. On ne
  // sort pas d'une page où l'on n'est pas encore entré.
  if (!connecte) {
    return (
      <>
        {import.meta.env.DEV ? <BandeApercu t={t} role={role} setRole={setRole} connecte={connecte} setConnecte={setConnecte} /> : null}
        <EcranConnexion
          langue={langue}
          onDemanderCode={async ({ email }) => {
            await api.appeler("/admin/auth/otp", {
              methode: "POST",
              corps: { email },
              schema: demandeCodeReponseSchema,
            });
          }}
          onVerifierCode={async ({ email, code }) => {
            try {
              const paire = await api.appeler("/admin/auth/otp/verify", {
                methode: "POST",
                corps: { email, code },
                schema: sessionAdminSchema,
              });
              api.ouvrir({
                acces: paire.accessToken,
                rafraichissement: paire.refreshToken,
                role: paire.role,
                // Le serveur ne la rend pas : c'est celle qu'on vient de saisir.
                email,
              });
              setRole(paire.role);
              return true;
            } catch (echec) {
              // L'écran traduit le code ; il ne verra jamais le message du
              // serveur. Une erreur d'une autre nature vaut refus muet.
              return echec instanceof ErreurApi ? codeConnu(echec.code) : false;
            }
          }}
          onEntre={() => setConnecte(true)}
        />
      </>
    );
  }

  return (
    <>
      {/* Bande d'aperçu, hors de l'outil : la bascule de rôle n'est pas un
          contrôle du produit — c'est le serveur qui décide d'un rôle. Elle
          disparaît le jour où l'authentification arrive (tâche 10). */}
      {import.meta.env.DEV ? <BandeApercu t={t} role={role} setRole={setRole} connecte={connecte} setConnecte={setConnecte} /> : null}

      {avis ? (
        <Toast libelleFermer={t.commun.fermer} onDismiss={() => setAvis(null)}>
          {t.codes[avis]}
        </Toast>
      ) : null}

      {avisExport ? (
        <Toast libelleFermer={t.commun.fermer} onDismiss={() => setAvisExport(null)}>
          {avisExport}
        </Toast>
      ) : null}

      <AdminShell
        navOuverte={navOuverte}
        onFermerNav={() => setNavOuverte(false)}
        sidebar={
          <Sidebar
            familles={familles}
            active={section}
            onSelect={aller}
            role={role}
            marque={MARQUE}
          />
        }
        topbar={
          <Topbar
            // L'adresse du compte connecté, portée par la session depuis
            // l'entrée. Une adresse écrite en dur montrait ici le compte de
            // quelqu'un d'autre à tout le monde.
            compte={api.session()?.email ?? ""}
            role={role}
            langue={langue}
            onLangue={setLangue}
            nuit={nuit}
            onTheme={() => setNuit((n) => !n)}
            onMenu={() => setNavOuverte(true)}
            onProfil={() => aller("profil")}
            onDeconnexion={() => void deconnecter()}
            t={t.barre}
          />
        }
      >
        {vue}
      </AdminShell>
    </>
  );
}
