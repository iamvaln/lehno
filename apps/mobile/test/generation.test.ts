import { describe, expect, it } from "vitest";
import {
  startGenerationSchema, updateMessageSchema,
  type GeneratedMessage, type GenerationResult, type MessageStatus,
} from "@lehno/contracts";
import {
  DELAI_MAX, LIMITE_DU_MESSAGE, PREMIER_DELAI, correctionDuMessage, creditRendu,
  delaiAvantLaProchaine, doitInterroger, marquageEnvoye, montreLeCout,
  offreDeRefaire, ouverture, peutEnregistrerLAjustement, phaseDuResultat,
  relanceDuMessage, texteUtile,
} from "../lib/generation.js";

const GENERATION = "11111111-1111-4111-8111-111111111111";
const OCCURRENCE = "33333333-3333-4333-8333-333333333333";
const MESSAGE = "22222222-2222-4222-8222-222222222222";
const OCCASION = "33333333-3333-4333-8333-333333333333";
const PROCHE = "44444444-4444-4444-8444-444444444444";

const brouillon = (statut: MessageStatus = "generated"): GeneratedMessage => ({
  id: MESSAGE,
  occurrenceId: OCCASION,
  content: "Valery, 36 ans et toujours cette manie de refaire le monde à minuit.",
  contentShort: null,
  status: statut,
  createdAt: "2026-08-26T10:00:00Z",
  updatedAt: "2026-08-26T10:00:00Z",
});

const resultat = (
  status: GenerationResult["generation"]["status"],
  message: GeneratedMessage | null,
): GenerationResult => ({
  generation: {
    id: GENERATION,
    kind: "wish_message",
    /* La CIBLE, arrivée au contrat après ce lot : « sans elle, une génération
       en cours n'a ni nom à afficher ni décompte à montrer ». L'une des deux
       est nulle selon la nature — un message vise une occasion. */
    personId: null,
    occurrenceId: OCCURRENCE,
    status,
    creditsSpent: 1,
    failureReason: status === "failed" ? "provider_unavailable" : null,
    resultId: message ? MESSAGE : null,
    createdAt: "2026-08-26T10:00:00Z",
  },
  message,
});

describe("l'écran s'ouvre en observateur", () => {
  /* L'ATTENTE N'ENFERME PAS, et RIEN NE SE REPAIE. La demande est partie
     avant qu'on arrive ; revenir sur une génération en cours ne doit pas la
     redemander. Ce test est la garde : l'ouverture ne sait former qu'une
     lecture, et son chemin n'est pas celui du lancement. */
  it("lit la génération, elle ne la relance pas", () => {
    const ouvre = ouverture(GENERATION);
    expect(ouvre.sorte).toBe("observer");
    expect(ouvre.sorte === "observer" && ouvre.chemin).toBe(`/me/generations/${GENERATION}`);
    expect(ouvre.sorte === "observer" && ouvre.chemin).not.toBe("/me/generations");
  });

  /* Sans identifiant il n'y a rien à observer — et surtout rien à lancer pour
     se donner quelque chose à montrer : ce serait un crédit débité que
     personne n'a demandé. */
  it("ne lance rien quand on arrive sans identifiant", () => {
    expect(ouverture(undefined)).toEqual({ sorte: "sans-objet" });
    expect(ouverture("")).toEqual({ sorte: "sans-objet" });
  });
});

describe("les deux moments du même écran", () => {
  it("attend tant que la production travaille", () => {
    expect(phaseDuResultat(resultat("running", null))).toBe("attente");
  });

  it("montre le texte quand il est là", () => {
    expect(phaseDuResultat(resultat("succeeded", brouillon()))).toBe("resultat");
  });

  it("dit l'échec quand la production a échoué", () => {
    expect(phaseDuResultat(resultat("failed", null))).toBe("echec");
  });

  it("charge tant que la première réponse n'est pas là", () => {
    expect(phaseDuResultat(null)).toBe("chargement");
  });

  /* LE CAS QUI PIÈGE. Le contrat dit le message nul « tant que l'exécution n'a
     pas abouti », donc `succeeded` sans message ne devrait pas exister. S'y
     fier ferait tourner la roue POUR TOUJOURS le jour où il arrive : il n'y a
     rien à lire, et le sondage s'est arrêté puisque le statut n'est plus
     `running`. */
  it("n'attend pas indéfiniment un aboutissement sans contenu", () => {
    expect(phaseDuResultat(resultat("succeeded", null))).not.toBe("attente");
    expect(phaseDuResultat(resultat("succeeded", null))).toBe("echec");
  });
});

describe("« votre crédit n'a pas été prélevé »", () => {
  it("se dit quand la production a échoué", () => {
    expect(creditRendu(resultat("failed", null))).toBe(true);
  });

  /* Un aboutissement sans contenu a bel et bien dépensé le crédit. Promettre
     un remboursement là serait un mensonge, et de ceux qu'on découvre sur son
     solde. */
  it("ne se dit pas d'un aboutissement sans contenu", () => {
    expect(creditRendu(resultat("succeeded", null))).toBe(false);
  });
});

describe("le sondage", () => {
  it("ne reprend que tant que ça travaille", () => {
    expect(doitInterroger("running")).toBe(true);
    expect(doitInterroger("succeeded")).toBe(false);
    expect(doitInterroger("failed")).toBe(false);
  });

  it("double le délai, puis plafonne", () => {
    expect(delaiAvantLaProchaine(0)).toBe(PREMIER_DELAI);
    expect(delaiAvantLaProchaine(1)).toBe(2 * PREMIER_DELAI);
    expect(delaiAvantLaProchaine(2)).toBe(DELAI_MAX);
    expect(delaiAvantLaProchaine(20)).toBe(DELAI_MAX);
  });

  /* Un compteur mal remis à zéro donnerait `setTimeout(0)` en boucle —
     c'est-à-dire une rafale d'appels au serveur pour une attente qui se
     voulait patiente. Jamais de délai nul. */
  it("ne descend jamais à zéro sur un compteur aberrant", () => {
    expect(delaiAvantLaProchaine(-3)).toBe(PREMIER_DELAI);
    expect(delaiAvantLaProchaine(Number.NaN)).toBe(PREMIER_DELAI);
    expect(delaiAvantLaProchaine(Number.POSITIVE_INFINITY)).toBe(PREMIER_DELAI);
  });
});

describe("ajuster le texte", () => {
  const original = brouillon().content;

  it("forme un PATCH sur le message, avec le seul contenu", () => {
    const envoi = correctionDuMessage(MESSAGE, "Un autre texte.", original);
    expect(envoi?.chemin).toBe(`/me/messages/${MESSAGE}`);
    expect(envoi?.corps).toEqual({ content: "Un autre texte." });
  });

  it("passe le schéma réel du contrat", () => {
    const envoi = correctionDuMessage(MESSAGE, "Un autre texte.", original);
    expect(updateMessageSchema.safeParse(envoi?.corps).success).toBe(true);
  });

  /* `updateMessageSchema` est `strict()` et ses deux champs sont facultatifs :
     `markSent: false` y passerait, et déclarerait quelque chose que
     l'utilisateur n'a pas dit. Corriger n'est pas envoyer. */
  it("ne déclare rien sur l'envoi en corrigeant", () => {
    const envoi = correctionDuMessage(MESSAGE, "Un autre texte.", original);
    expect(envoi?.corps).not.toHaveProperty("markSent");
  });

  /* LE DÉFAUT QUI NE SE RATTRAPE PAS : « `edited` se pose à la première
     correction et ne se retire plus ». Un PATCH pour un texte identique
     marquerait comme retouché un message auquel personne n'a touché, et
     fausserait durablement la seule mesure qui dit si nos brouillons
     tiennent. Ouvrir « Ajuster » puis refermer sans rien changer est le geste
     le plus banal de cet écran. */
  it("n'envoie rien quand le texte n'a pas changé", () => {
    expect(correctionDuMessage(MESSAGE, original, original)).toBeNull();
    expect(peutEnregistrerLAjustement(original, original)).toBe(false);
  });

  it("n'envoie rien pour des blancs ajoutés puis retirés", () => {
    expect(correctionDuMessage(MESSAGE, `  ${original}\n`, original)).toBeNull();
  });

  it("n'envoie rien d'un texte vide ou de blancs seuls", () => {
    expect(correctionDuMessage(MESSAGE, "", original)).toBeNull();
    expect(correctionDuMessage(MESSAGE, "   \n  ", original)).toBeNull();
  });

  it("rogne les blancs comme le contrat", () => {
    expect(texteUtile("  Bon anniversaire. ")).toBe("Bon anniversaire.");
    expect(correctionDuMessage(MESSAGE, "  Bon anniversaire. ", original)?.corps)
      .toEqual({ content: "Bon anniversaire." });
  });

  /* La borne est celle du contrat, pas la nôtre : si `updateMessageSchema`
     bouge, ce test tombe avant que l'écran n'envoie du refusé. */
  it("s'arrête à la borne du contrat", () => {
    const pleine = "a".repeat(LIMITE_DU_MESSAGE);
    expect(updateMessageSchema.safeParse({ content: pleine }).success).toBe(true);
    expect(updateMessageSchema.safeParse({ content: `${pleine}a` }).success).toBe(false);
    expect(correctionDuMessage(MESSAGE, pleine, original)).not.toBeNull();
    expect(correctionDuMessage(MESSAGE, `${pleine}a`, original)).toBeNull();
  });
});

describe("marquer envoyé, qui est une affirmation", () => {
  it("forme un PATCH déclaratif, sans toucher au texte", () => {
    const envoi = marquageEnvoye(MESSAGE, "generated", "sharedAction");
    expect(envoi?.chemin).toBe(`/me/messages/${MESSAGE}`);
    expect(envoi?.corps).toEqual({ markSent: true });
    // Y glisser le contenu écraserait le texte du serveur avec ce que l'écran
    // avait en mémoire — un ajustement d'une autre séance disparaîtrait.
    expect(envoi?.corps).not.toHaveProperty("content");
    expect(updateMessageSchema.safeParse(envoi?.corps).success).toBe(true);
  });

  /* LA GARDE QUI COMPTE : sur iOS, refermer la feuille de partage sans rien
     choisir rend `dismissedAction`. Marquer envoyé là simulerait la preuve
     d'envoi que le contrat refuse explicitement de donner. */
  it("ne marque rien quand la feuille de partage a été refermée", () => {
    expect(marquageEnvoye(MESSAGE, "generated", "dismissedAction")).toBeNull();
    expect(marquageEnvoye(MESSAGE, "edited", "dismissedAction")).toBeNull();
  });

  // « Un message envoyé puis corrigé reste envoyé » : le redire ne change rien
  // et coûte un aller-retour.
  it("ne redit pas ce qui est déjà envoyé", () => {
    expect(marquageEnvoye(MESSAGE, "sent", "sharedAction")).toBeNull();
  });

  it("marque un brouillon corrigé comme un brouillon neuf", () => {
    expect(marquageEnvoye(MESSAGE, "edited", "sharedAction")?.corps).toEqual({ markSent: true });
  });
});

describe("refaire, qui coûte un crédit", () => {
  it("vise l'occasion, et passe le schéma réel du lancement", () => {
    const envoi = relanceDuMessage(OCCASION);
    expect(envoi?.chemin).toBe("/me/generations");
    expect(envoi?.corps).toEqual({ kind: "wish_message", occurrenceId: OCCASION });
    expect(startGenerationSchema.safeParse(envoi?.corps).success).toBe(true);
  });

  /* Le schéma refuse `personId` sur autre chose qu'un portrait, et
     `studioSelection` sur autre chose qu'une image. Ces deux-là prouvent que
     la forme choisie n'est pas la seule que nous acceptions, mais la seule que
     le CONTRAT accepte. */
  it("ne porte ni le proche ni le studio, que le contrat refuserait", () => {
    expect(startGenerationSchema.safeParse({
      kind: "wish_message", occurrenceId: OCCASION, personId: PROCHE,
    }).success).toBe(false);
    expect(startGenerationSchema.safeParse({
      kind: "wish_message", occurrenceId: OCCASION, studioSelection: { orientation: "relation" },
    }).success).toBe(false);
  });

  /* Sans occasion connue — on arrive d'une notification, d'une reprise — il n'y
     a rien à relancer. Le bouton se retire : pas de bouton grisé, pas de geste
     qui échoue. */
  it("ne se forme pas sans occasion", () => {
    expect(relanceDuMessage(undefined)).toBeNull();
    expect(relanceDuMessage("")).toBeNull();
  });
});

describe("les drapeaux", () => {
  /* « Ce chemin n'est PAS sous le drapeau de la génération. Éteindre
     `generation.message` doit empêcher d'en produire de nouveaux, pas de
     relire et d'ajuster ceux qu'on a déjà payés. » Mettre les deux sous le même
     interrupteur ferait disparaître un contenu acheté. */
  it("retire « Refaire » sans toucher à la relecture", () => {
    expect(offreDeRefaire([])).toBe(false);
    expect(offreDeRefaire(["generation.message"])).toBe(true);
    // Le drapeau éteint, la correction se forme toujours : elle n'en dépend pas.
    expect(correctionDuMessage(MESSAGE, "Un autre texte.", brouillon().content)).not.toBeNull();
    expect(marquageEnvoye(MESSAGE, "generated", "sharedAction")).not.toBeNull();
  });

  /* LE PIÈGE DU BRIEF : « l'achat éteint ne ferme pas les générations, il les
     rend gratuites ». Rappeler un coût à quelqu'un qui vient de recevoir
     quelque chose sans payer serait un prix affiché sur un cadeau. */
  it("tait le coût quand les crédits sont fermés", () => {
    expect(montreLeCout([])).toBe(false);
    expect(montreLeCout(["generation.message"])).toBe(false);
    expect(montreLeCout(["credits"])).toBe(true);
  });
});
