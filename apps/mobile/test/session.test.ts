import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { doitRenouveler, sortDeLaSession, leClientEstRefuse, messageDErreur } from "../lib/session.js";

describe("le renouvellement silencieux", () => {
  /* Un jeton d'accès expire souvent — c'est sa raison d'être. Le client
     renouvelle et rejoue l'appel sans que personne le voie. */
  it("renouvelle sur une session expirée", () => {
    expect(doitRenouveler(401, "session_expired")).toBe(true);
  });

  /* `refresh_reused` dit qu'un jeton de rafraîchissement a servi deux fois :
     le serveur a fermé la session par sécurité. Réessayer serait au mieux
     inutile, au pire une boucle — et ce serait rejouer le geste qui a déclenché
     l'alerte. */
  it("ne renouvelle jamais après un jeton rejoué", () => {
    expect(doitRenouveler(401, "refresh_reused")).toBe(false);
    expect(sortDeLaSession("refresh_reused")).toBe(true);
  });

  // Un 403 n'est pas une question de session : renouveler ne changerait rien.
  it("ne renouvelle pas sur un droit refusé", () => {
    expect(doitRenouveler(403, "forbidden")).toBe(false);
  });

  // 404 sur une ressource d'autrui ou une surface éteinte : rien à renouveler.
  it("ne renouvelle pas sur un 404", () => {
    expect(doitRenouveler(404, "not_found")).toBe(false);
  });

  /* Une session fermée par le serveur — compte suspendu, suppression demandée —
     se termine côté client aussi. Rester connecté sur un compte suspendu
     donnerait une application qui échoue à chaque geste sans dire pourquoi. */
  it("termine la session quand le compte n'en a plus", () => {
    expect(sortDeLaSession("account_suspended")).toBe(true);
    expect(sortDeLaSession("account_pending_deletion")).toBe(true);
    expect(sortDeLaSession("otp_invalid")).toBe(false);
  });
});

describe("les messages d'erreur", () => {
  // Le contrat commun est net : « le client ne montre jamais le message brut,
  // il traduit le code ». C'est ce qui rend l'application bilingue sans que le
  // serveur connaisse la langue de celui qui l'appelle.
  it("traduit le code, jamais le message du serveur", () => {
    const brut = { code: "otp_invalid" as const, message: "OTP mismatch for user 42" };
    expect(messageDErreur(brut, "fr")).not.toContain("user 42");
    expect(messageDErreur(brut, "fr")).toBe("Ce code ne correspond pas.");
    expect(messageDErreur(brut, "en")).not.toBe(messageDErreur(brut, "fr"));
  });

  /* Une panne de réseau n'a pas de code : le serveur n'a rien rendu. Sans
     repli, l'écran afficherait du vide là où il faut dire qu'on réessaiera. */
  it("porte un repli quand le serveur n'a rien dit", () => {
    expect(messageDErreur(null, "fr")).toBeTruthy();
    expect(messageDErreur(null, "en")).toBeTruthy();
    expect(messageDErreur(null, "fr")).not.toBe(messageDErreur(null, "en"));
  });
});

describe("le client refusé n'est pas le compte refusé", () => {
  it("se reconnaît au 403 et à son code", () => {
    expect(leClientEstRefuse(403, "client_unknown")).toBe(true);
  });

  /* `forbidden` est le refus ORDINAIRE, celui d'un compte. Les confondre
     afficherait « votre compte est refusé » à quelqu'un dont le compte va très
     bien — c'est exactement ce que le code distinct existe pour éviter. */
  it("ne se confond pas avec un refus ordinaire", () => {
    expect(leClientEstRefuse(403, "forbidden")).toBe(false);
  });

  it("ne se déclenche pas sur un autre statut", () => {
    expect(leClientEstRefuse(401, "client_unknown")).toBe(false);
  });

  /* LES DEUX GARDES QUI DÉCONNECTERAIENT. Un `client_unknown` ne doit ni
     renouveler le jeton — rien ne changerait — ni sortir de la session, ce qui
     ferait perdre la sienne à quelqu'un dont le compte est sain. */
  it("ne renouvelle pas, et ne sort pas de la session", () => {
    expect(doitRenouveler(403, "client_unknown")).toBe(false);
    expect(sortDeLaSession("client_unknown")).toBe(false);
  });
});

/* L'ÉCRAN DE REFUS N'OFFRE PAS DE RÉESSAYER, et cette garde lit la source parce
 * qu'aucun test d'unité ne verrait le bouton revenir.
 *
 * La spec le dit deux fois — « ne jamais retenter », « ni reconnexion, ni
 * réessai » — et le piège est qu'il n'y a qu'UN écran pour deux arrêts : le
 * bouton appartient à la maintenance, où il sert. Quelqu'un qui sortirait le
 * bloc de sa condition le rendrait à un refus de client, où il tourne à vide
 * et laisse croire qu'insister peut marcher.
 */
describe("l'écran d'arrêt ne propose rien à qui est refusé", () => {
  const ecran = readFileSync(
    new URL("../app/maintenance.tsx", import.meta.url),
    "utf8",
  );

  /* LE BOUTON EST DERRIÈRE LES DEUX CONDITIONS, et le test le vérifie par leur
     POSITION plutôt que par une chaîne exacte : la chaîne a déjà changé une fois
     quand le 426 est venu s'intercaler, et une garde qui tombe à chaque
     réécriture finit par être désactivée au lieu d'être lue. */
  it("ne propose « Réessayer » qu'après avoir écarté le refus et la mise à jour", () => {
    const bouton = ecran.indexOf("maintReessayer");
    expect(bouton).toBeGreaterThan(-1);
    expect(ecran.lastIndexOf("refuse ? null :", bouton)).toBeGreaterThan(-1);
    expect(ecran.lastIndexOf("majRequise ?", bouton)).toBeGreaterThan(-1);
  });

  it("ne le propose qu'une seule fois", () => {
    expect(ecran.split("maintReessayer").length - 1).toBe(1);
  });

  it("dit un autre titre et un autre texte pour chacun des trois arrêts", () => {
    expect(ecran).toContain("refuse ? t.refusTitre : majRequise ? t.majTitre : t.maintTitre");
    expect(ecran).toContain("refuse ? t.refusTexte : majRequise ? t.majTexte :");
  });

  /* ET LE MAGASIN NE S'OUVRE QUE S'IL EST CONNU. `lienDuMagasin` rend `null`
     quand le refus ne portait pas d'adresse — offrir alors un bouton ouvrirait
     le vide. */
  it("n'offre le magasin que lorsque le serveur a dit où aller", () => {
    expect(ecran).toContain("magasin === null ? null : (");
  });
});
