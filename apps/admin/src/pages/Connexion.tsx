import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { demandeCodeSchema, verificationCodeSchema } from "@lehno/contracts";

import { BrandMark, Button } from "../composants/base/index.js";
import { messages, type Langue } from "../i18n/index.js";

/** Les codes que l'écran sait dire. Dérivé du dictionnaire : un code sans
 *  phrase ne compile pas, plutôt que de s'afficher vide en séance. */
type CleCode = keyof ReturnType<typeof messages>["codes"];

/* L'entrée du back-office (§5.1). Une adresse, puis un code à six chiffres :
 * **pas de mot de passe**. L'écran vit hors de la coquille — ni barre latérale,
 * ni barre haute, ni navigation : on n'est pas encore dans l'outil.
 *
 * La règle qui gouverne tout le reste : **l'écran répond exactement la même
 * chose à une adresse connue et à une adresse inconnue**. Elle se tient de
 * trois façons ici.
 *
 * 1. Par la forme du contrat. `onDemanderCode` ne rend rien — comme
 *    `demandeCodeReponseSchema`, qui vaut toujours `{ envoye: true }`. Il n'y a
 *    aucun canal par lequel l'existence d'un compte pourrait remonter jusqu'au
 *    rendu : le message d'envoi ne dépend que de l'adresse saisie.
 * 2. Par le temps. Une adresse connue coûte un envoi de courriel, une adresse
 *    inconnue ne coûte rien : la différence se mesure au chronomètre et donne
 *    la liste de l'équipe aussi sûrement qu'un message. L'écran attend donc un
 *    **plancher fixe** avant de répondre, et ne bascule qu'une fois ce plancher
 *    écoulé — que la demande ait mis 5 ms ou 400.
 * 3. Par l'échec. Un rejet de `onDemanderCode` est une panne de transport, pas
 *    un verdict sur le compte : le message est celui de la panne, et il passe
 *    par le même plancher.
 *
 * Deux garde-fous repris du prototype : le renvoi d'un code attend trente
 * secondes, à rebours visible, et trois codes refusés ferment la saisie.
 */

/** Le contrat n'exporte que ses schémas ; les deux formes se lisent depuis eux
 *  plutôt que d'être recopiées ici — et sans faire entrer zod dans l'admin. */
type DemandeCode = ReturnType<typeof demandeCodeSchema.parse>;
type VerificationCode = ReturnType<typeof verificationCodeSchema.parse>;

/** Le rebours du renvoi, en secondes. Exporté : les tests le tiennent. */
export const ATTENTE_RENVOI_S = 30;

/** Le plancher de réponse à une demande de code, en millisecondes. Il n'accélère
 *  rien — il empêche l'écran de répondre plus vite à une adresse inconnue. */
export const DELAI_REPONSE_MS = 600;

const TENTATIVES = 3;
const LONGUEUR_CODE = 6;
const SECONDE_MS = 1000;

/** Simulation de l'aperçu, faute de serveur : le code `000000` est refusé, tout
 *  autre code de six chiffres entre. C'est une simulation, et rien d'autre — la
 *  vraie vérification arrive par `onVerifierCode`. */
function verificationSimulee({ code }: VerificationCode): boolean {
  return code !== "000000";
}

export interface ConnexionProps {
  langue?: Langue;
  /** Demande d'un code à usage unique. **Ne rend rien** : une réponse qui
   *  distinguerait un compte connu d'un compte inconnu trahirait l'équipe.
   *  Un rejet ne dit qu'une panne d'envoi. */
  onDemanderCode?: (demande: DemandeCode) => void | Promise<void>;
  /** Vérifie le code. Par défaut, la simulation de l'aperçu.
   *
   *  Rend `true` si l'entrée est acquise, `false` pour un refus sans raison
   *  dite, ou **le code du refus** — que l'écran traduit. Un code expiré n'est
   *  pas un code faux : le dire coûterait une tentative pour rien. */
  onVerifierCode?: (verification: VerificationCode) => Verdict | Promise<Verdict>;
  /** L'entrée est acquise : à l'appelant d'ouvrir l'outil. */
  onEntre?: () => void;
}

type Etape = "adresse" | "code";

/** `true` entre ; `false` refuse sans raison dite ; un code dit laquelle. */
export type Verdict = boolean | CleCode;

export function Connexion({
  langue = "fr",
  onDemanderCode,
  onVerifierCode = verificationSimulee,
  onEntre,
}: ConnexionProps): ReactNode {
  const t = messages(langue);
  const idAdresse = useId();
  const idCode = useId();

  const [etape, setEtape] = useState<Etape>("adresse");
  const [adresse, setAdresse] = useState("");
  const [code, setCode] = useState("");
  const [restantes, setRestantes] = useState(TENTATIVES);
  const [erreur, setErreur] = useState<string | null>(null);
  const [attente, setAttente] = useState(0);
  const [enCours, setEnCours] = useState(false);

  // Le rebours du renvoi : une seconde à la fois, arrêté à zéro. Un battement
  // unique, et non une minuterie réarmée à chaque seconde : réarmer dépendrait
  // du rendu qui suit chaque décompte, et le rebours avancerait au rythme des
  // rendus plutôt qu'à celui de l'horloge.
  const enAttente = attente > 0;
  useEffect(() => {
    if (!enAttente) return;
    const battement = setInterval(() => setAttente((reste) => (reste <= 1 ? 0 : reste - 1)), SECONDE_MS);
    return () => clearInterval(battement);
  }, [enAttente]);

  const demande = demandeCodeSchema.safeParse({ email: adresse.trim() });
  const verification = verificationCodeSchema.safeParse({ email: adresse.trim(), code });
  const bloque = restantes <= 0;

  async function envoyer(evenement?: FormEvent) {
    evenement?.preventDefault();
    if (!demande.success || enCours) return;

    setEnCours(true);
    setErreur(null);

    // Le plancher part **avant** la demande : il court pendant, pas après.
    const plancher = new Promise<void>((tenir) => setTimeout(tenir, DELAI_REPONSE_MS));

    try {
      await Promise.all([onDemanderCode?.(demande.data), plancher]);
    } catch {
      // Même une panne attend le plancher : un échec instantané dirait « cette
      // adresse n'a rien coûté ».
      await plancher;
      setEnCours(false);
      setErreur(t.connexion.echec);
      return;
    }

    setEnCours(false);
    setEtape("code");
    setCode("");
    setRestantes(TENTATIVES);
    setAttente(ATTENTE_RENVOI_S);
  }

  async function entrer(evenement?: FormEvent) {
    evenement?.preventDefault();
    if (!verification.success || bloque || enCours) return;

    setEnCours(true);
    const verdict = await onVerifierCode(verification.data);
    setEnCours(false);

    if (verdict === true) {
      onEntre?.();
      return;
    }

    setCode("");

    // Un refus qui porte un code autre qu'« otp_invalid » n'est pas un code
    // faux : il a expiré, le serveur a fermé la saisie, ou le service est
    // injoignable. Décompter une tentative punirait quelqu'un qui n'a rien
    // fait de mal — et masquerait la vraie cause derrière « code refusé ».
    if (typeof verdict === "string" && verdict !== "otp_invalid") {
      setErreur(t.codes[verdict]);
      // Le serveur tient son propre compte, et il survit à un rechargement de
      // page là où le compteur de l'écran repart à trois. Quand il dit que
      // c'est fini, c'est fini.
      if (verdict === "otp_too_many_attempts") setRestantes(0);
      return;
    }

    // Le décompte se dit : trois codes refusés ferment la saisie, et l'écran
    // annonce combien il en reste avant que ça arrive.
    const reste = restantes - 1;
    setRestantes(reste);
    setErreur(
      reste > 1
        ? t.connexion.faux.replace("{n}", String(reste))
        : reste === 1
          ? t.connexion.fauxUn
          : t.connexion.epuise,
    );
  }

  const avis = erreur ? (
    <p className="connexion-erreur" role="alert">
      {erreur}
    </p>
  ) : null;

  return (
    <main className="connexion">
      <div className="connexion-marque">
        <BrandMark size={30} />
        <span className="connexion-badge">{t.connexion.marque}</span>
      </div>

      <div className="connexion-carte">
        {etape === "adresse" ? (
          <form onSubmit={envoyer} noValidate>
            <h1 className="connexion-titre">{t.connexion.titre}</h1>
            <p className="connexion-sous">{t.connexion.sous}</p>

            {avis}

            <label className="connexion-label" htmlFor={idAdresse}>
              {t.connexion.adresse}
            </label>
            <input
              id={idAdresse}
              className="admin-champ admin-focus connexion-saisie"
              type="email"
              autoComplete="username"
              value={adresse}
              onChange={(evenement) => setAdresse(evenement.target.value)}
              placeholder={t.connexion.adressePlaceholder}
            />

            <div className="connexion-geste">
              <Button variant="primary" type="submit" full disabled={!demande.success || enCours}>
                {t.connexion.envoyer}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={entrer} noValidate>
            <h1 className="connexion-titre">{t.connexion.titreCode}</h1>
            {/* Une seule phrase, non découpée : l'adresse est celle qu'on vient
                de saisir, pas une confirmation que le compte existe. */}
            <p className="connexion-sous">{t.connexion.envoye.replace("{adresse}", adresse.trim())}</p>

            {avis}

            <label className="connexion-label" htmlFor={idCode}>
              {t.connexion.code}
            </label>
            <input
              id={idCode}
              className="admin-champ admin-focus connexion-saisie connexion-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={LONGUEUR_CODE}
              value={code}
              disabled={bloque}
              onChange={(evenement) =>
                setCode(evenement.target.value.replace(/\D/g, "").slice(0, LONGUEUR_CODE))
              }
            />

            <div className="connexion-geste">
              <Button
                variant="primary"
                type="submit"
                full
                disabled={bloque || !verification.success || enCours}
              >
                {t.connexion.entrer}
              </Button>
            </div>

            <div className="connexion-pied">
              <Button variant="text" onClick={() => void envoyer()} disabled={attente > 0 || enCours}>
                {attente > 0
                  ? t.connexion.renvoyerDans.replace("{n}", String(attente))
                  : t.connexion.renvoyer}
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  setEtape("adresse");
                  setCode("");
                  setErreur(null);
                  setAttente(0);
                }}
              >
                {t.connexion.changer}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
