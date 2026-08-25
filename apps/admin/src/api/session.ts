import { z } from "zod";
import { adminRoleSchema } from "@lehno/contracts";
import type { MagasinSession, Session } from "./client.js";

/**
 * Où vit la session entre deux chargements de page. Le client d'API ne connaît
 * que l'interface ; c'est ici qu'on décide du stockage, et qu'on encaisse ses
 * refus.
 */

export const CLE_SESSION = "lehno.admin.session";

// Ce qu'on relit du stockage n'est pas ce qu'on y a écrit : c'est du texte
// qu'un utilisateur peut avoir modifié à la main dans son navigateur. On le
// valide comme n'importe quelle entrée — une session bricolée doit valoir
// « pas de session », pas un rôle inventé.
const sessionStockeeSchema = z.object({
  acces: z.string().min(1),
  rafraichissement: z.string().min(1),
  role: adminRoleSchema,
}).strict();

/**
 * Le magasin adossé au stockage du navigateur. Chaque accès est gardé : un
 * onglet privé, des données de site effacées ou un navigateur réglé pour
 * refuser peuvent faire échouer la lecture comme l'écriture. L'outil s'ouvre
 * quand même — la session tient alors le temps de la visite, et c'est tout ce
 * qu'on promet.
 */
export const magasinLocal: MagasinSession = {
  lire(): Session | null {
    let brut: string | null;
    try {
      brut = localStorage.getItem(CLE_SESSION);
    } catch {
      return null;
    }
    if (!brut) return null;
    try {
      const valide = sessionStockeeSchema.safeParse(JSON.parse(brut));
      return valide.success ? valide.data : null;
    } catch {
      // Contenu illisible : on l'ignore plutôt que d'empêcher l'outil de
      // démarrer. La connexion reprend la main.
      return null;
    }
  },

  ecrire(session: Session): void {
    try {
      localStorage.setItem(CLE_SESSION, JSON.stringify(session));
    } catch {
      // Stockage refusé. Rien à faire de plus : le magasin en mémoire
      // ci-dessous garde la session pour la visite en cours.
    }
  },

  effacer(): void {
    try {
      localStorage.removeItem(CLE_SESSION);
    } catch {
      // Idem — on ne peut pas effacer ce qu'on n'a pas pu écrire.
    }
  },
};

/**
 * Un magasin qui garde la session en mémoire par-dessus le stockage. Sans lui,
 * un navigateur qui refuse d'écrire perdrait la session au premier appel
 * suivant : `lire()` rendrait null juste après un `ecrire()` réussi en
 * apparence.
 */
export function magasinAvecMemoire(fond: MagasinSession = magasinLocal): MagasinSession {
  let memoire: Session | null = null;
  return {
    // Le fond est relu tant que la mémoire est vide, plutôt qu'une seule fois à
    // la construction : le magasin se crée au chargement du module, avant que
    // quoi que ce soit ait pu écrire. Une fois la session en mémoire, elle
    // prime — c'est elle qui survit à un stockage qui refuse d'écrire.
    lire: () => memoire ?? fond.lire(),
    ecrire(session) {
      memoire = session;
      fond.ecrire(session);
    },
    effacer() {
      memoire = null;
      fond.effacer();
    },
  };
}

/**
 * L'adresse du service. En développement, Vite sert l'outil sur un autre port
 * que l'API — d'où la valeur de repli plutôt qu'un chemin relatif.
 */
export function baseApi(): string {
  const declaree = import.meta.env["VITE_API_URL"] as string | undefined;
  return declaree ? declaree : "http://localhost:3000/v1";
}
