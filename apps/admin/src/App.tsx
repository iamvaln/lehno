import { useEffect, useState, type ReactNode } from "react";
import { AdminShell, Sidebar, Topbar } from "./composants/coquille/index.js";
import { EmptyState, Ressource } from "./composants/donnees/index.js";
import { TableauDeBord, Liste, Detail, Edition, Suppressions, Connexion, Profil } from "./pages/index.js";
import type { RequeteComptes } from "./pages/Liste.js";
import { codeConnu, messages, type Langue } from "./i18n/index.js";
import { familles as famillesDuRole, sectionAutorisee } from "./navigation.js";

// Les états se disent en français dans le contrat ; la requête, elle, parle au
// serveur dans les termes de sa base. La traduction est ici, et nulle part
// ailleurs.
const ETAT_SERVEUR: Record<string, string> = {
  actif: "active",
  suspendu: "suspended",
  suppression_en_cours: "pending_deletion",
  efface: "deleted",
};
import { useRessource } from "./api/hooks.js";
import { compteDetailSchema, dashboardSchema, pageComptesSchema, parametresSchema } from "@lehno/contracts";
import { interventions, profil, suppressions } from "./fixtures/index.js";
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
const PRESSEES = new Set(["alertes", "moderation", "suppressions", "transactions"]);

// Les sections livrées ; les autres annoncent le gabarit qu'elles emploieront.
const GABARITS: Record<string, string> = {
  alertes: "liste", moderation: "liste", contact: "liste", attente: "liste",
  transactions: "liste", acces: "liste", metriques: "tableau", audit: "liste",
  connexions: "liste", liens: "liste",
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

  let vue: ReactNode;
  if (section === "profil") {
    vue = <Profil profil={profil} langue={langue} />;
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
            interventions={interventions.items}
            onRetour={() => setOuvert(null)}
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
    vue = <Suppressions role={role} langue={langue} demandes={suppressions.items} />;
  } else {
    vue = (
      <EmptyState
        titre={t.attente.titre}
        texte={`${t.attente.texte} ${t.attente.gabarit.replace("{gabarit}", t.gabarits[GABARITS[section] as keyof typeof t.gabarits] ?? "")}`}
      />
    );
  }

  // La connexion vit hors de la coquille : ni navigation, ni barre haute. On ne
  // sort pas d'une page où l'on n'est pas encore entré.
  if (!connecte) {
    return (
      <>
        {import.meta.env.DEV ? <BandeApercu t={t} role={role} setRole={setRole} connecte={connecte} setConnecte={setConnecte} /> : null}
        <Connexion
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
            compte="sam@lehno.app"
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
