import { useEffect, useState, type ReactNode } from "react";
import { AdminShell, Sidebar, Topbar } from "./composants/coquille/index.js";
import { EmptyState } from "./composants/donnees/index.js";
import { TableauDeBord, Liste, Detail, Edition, Suppressions, Connexion, Profil } from "./pages/index.js";
import { messages, type Langue } from "./i18n/index.js";
import { dashboard, comptes, compteDetail, interventions, parametres, profil, suppressions } from "./fixtures/index.js";
import type { AdminRole } from "@lehno/contracts";

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

// Les familles rangent les sections par ce que l'administrateur vient faire, pas
// par domaine. Le tableau de bord se pose au-dessus, sans titre : c'est l'accueil,
// pas une tâche — d'où une famille sans titre, que Sidebar rend sans en-tête.
const NAVIGATION: { famille: keyof ReturnType<typeof messages>["familles"] | null; items: string[] }[] = [
  { famille: null, items: ["tableau"] },
  { famille: "attention", items: ["alertes", "moderation", "suppressions", "contact", "attente"] },
  { famille: "finances", items: ["transactions"] },
  { famille: "gestion", items: ["comptes", "acces", "parametres"] },
  { famille: "surveiller", items: ["metriques", "audit", "connexions"] },
  { famille: "outils", items: ["liens"] },
];

const ICONES: Record<string, string> = {
  tableau: "layout-dashboard", alertes: "triangle-alert", moderation: "shield",
  suppressions: "user-minus", contact: "mail", attente: "hourglass",
  transactions: "receipt", comptes: "users", acces: "user-cog",
  parametres: "sliders-horizontal", metriques: "chart-column", audit: "scroll-text",
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

// Hors de l'outil : la bascule de rôle n'est pas un contrôle du produit — c'est
// le serveur qui décide d'un rôle. Elle disparaît avec l'authentification réelle.
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

export function App(): ReactNode {
  const [langue, setLangue] = useState<Langue>("fr");
  const [nuit, setNuit] = useState(themeInitial);
  const [role, setRole] = useState<AdminRole>("support");
  const [section, setSection] = useState("tableau");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [navOuverte, setNavOuverte] = useState(false);
  const [connecte, setConnecte] = useState(true);

  useClasseAdmin(nuit);
  const t = messages(langue);

  // Le titre du document suit la langue de l'outil : un onglet parmi vingt se
  // retrouve à son nom.
  useEffect(() => {
    document.title = t.outil.titre;
  }, [t]);

  const aller = (id: string): void => {
    setSection(id);
    setOuvert(null);
    setNavOuverte(false);
  };

  const familles = NAVIGATION.map(({ famille, items }) => ({
    titre: famille ? t.familles[famille] : "",
    items: items.map((id) => ({
      id,
      label: t.sections[id as keyof typeof t.sections],
      icon: ICONES[id] ?? "circle",
      ...(PRESSEES.has(id) ? { ton: "alerte" as const } : {}),
    })),
  }));

  let vue: ReactNode;
  if (section === "profil") {
    vue = <Profil profil={profil} langue={langue} />;
  } else if (section === "comptes" && ouvert) {
    vue = <Detail role={role} langue={langue} compte={compteDetail} interventions={interventions.items} onRetour={() => setOuvert(null)} />;
  } else if (section === "tableau") {
    vue = <TableauDeBord donnees={dashboard} t={t} onAller={aller} />;
  } else if (section === "comptes") {
    vue = <Liste role={role} langue={langue} comptes={comptes.items} onOuvrir={(c) => setOuvert(c.id)} />;
  } else if (section === "parametres") {
    vue = <Edition role={role} langue={langue} parametres={parametres} />;
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
        <BandeApercu t={t} role={role} setRole={setRole} connecte={connecte} setConnecte={setConnecte} />
        <Connexion langue={langue} onEntre={() => setConnecte(true)} />
      </>
    );
  }

  return (
    <>
      {/* Bande d'aperçu, hors de l'outil : la bascule de rôle n'est pas un
          contrôle du produit — c'est le serveur qui décide d'un rôle. Elle
          disparaît le jour où l'authentification arrive (tâche 10). */}
      <BandeApercu t={t} role={role} setRole={setRole} connecte={connecte} setConnecte={setConnecte} />

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
            onDeconnexion={() => setConnecte(false)}
            t={t.barre}
          />
        }
      >
        {vue}
      </AdminShell>
    </>
  );
}
