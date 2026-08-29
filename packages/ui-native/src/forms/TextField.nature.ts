import type { TextInputProps } from "react-native";

/* La nature de ce qu'on saisit, plutôt que huit réglages à reposer par écran.
 *
 * React Native capitalise la première lettre par défaut — `autoCapitalize` vaut
 * « sentences ». Sur une adresse électronique, il rend « Valentine@… » que le
 * serveur refuse ; sur un pseudo, le contrat n'accepte que des minuscules. Dans
 * les deux cas la majuscule est discrète, et l'erreur arrive au bout du réseau.
 *
 * Nommer la nature du champ met la règle à un seul endroit : le prochain champ
 * d'adresse la reçoit sans que personne y pense.
 */

export const NATURES_DE_CHAMP = ["texte", "email", "pseudo", "code"] as const;
export type NatureDeChamp = (typeof NATURES_DE_CHAMP)[number];

export interface ReglagesDeSaisie {
  autoCapitalize: TextInputProps["autoCapitalize"];
  autoCorrect: boolean;
  spellCheck: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  // Le remplissage automatique du système : l'adresse depuis le trousseau, le
  // code depuis le message reçu. Sans lui, la proposition ne paraît pas
  // au-dessus du clavier — et c'est ainsi que la plupart des gens saisissent.
  textContentType?: TextInputProps["textContentType"];
  autoComplete?: TextInputProps["autoComplete"];
  maxLength?: number;
}

export function reglagesDeSaisie(nature: NatureDeChamp): ReglagesDeSaisie {
  switch (nature) {
    case "email":
      return {
        autoCapitalize: "none",
        autoCorrect: false,
        spellCheck: false,
        // L'arobase et le point passent sur la rangée principale : trois gestes
        // épargnés à chaque saisie.
        keyboardType: "email-address",
        textContentType: "emailAddress",
        autoComplete: "email",
        maxLength: 254,
      };
    case "pseudo":
      return {
        autoCapitalize: "none",
        autoCorrect: false,
        spellCheck: false,
        autoComplete: "username",
        // La borne du contrat : `^[a-z0-9_]{3,30}$`.
        maxLength: 30,
      };
    case "code":
      return {
        autoCapitalize: "none",
        autoCorrect: false,
        spellCheck: false,
        keyboardType: "number-pad",
        textContentType: "oneTimeCode",
        autoComplete: "sms-otp",
      };
    default:
      // Une phrase ordinaire garde les usages du système : y toucher serait
      // gênant sur une note, où la majuscule et le correcteur rendent service.
      return { autoCapitalize: "sentences", autoCorrect: true, spellCheck: true };
  }
}

/* Ce que les réglages laissent encore passer : un collage, une dictée, un
   clavier tiers. La nature rattrape à la frappe plutôt qu'à l'envoi. */
export function nettoiePourLaNature(nature: NatureDeChamp, saisie: string): string {
  switch (nature) {
    case "email":
      return saisie.trim().toLowerCase();
    case "pseudo": {
      /* Le motif du serveur : lettres, chiffres, point, tiret, tiret bas, et
         une lettre ou un chiffre en tête. La casse se garde — c'est le nom que
         la personne montre sur son Mur, pas une clé de recherche.

         Retirer vaut mieux que refuser : on tape « .awa », le point ne
         s'affiche pas, et la règle se comprend sans qu'on l'explique. */
      const garde = saisie.replace(/[^a-zA-Z0-9._-]/g, "");
      return garde.replace(/^[^a-zA-Z0-9]+/, "");
    }
    case "code":
      return saisie.replace(/\D/g, "");
    default:
      return saisie;
  }
}

/* Le serveur tranche — c'est lui qui décide, et lui seul sait si l'adresse
   existe. Mais laisser partir une saisie manifestement incomplète coûte un
   aller-retour et une erreur à lire, là où le bouton pouvait rester éteint.

   La règle reste large à dessein : une adresse valide prend des formes que
   personne ne devine, et refuser à tort est pire que laisser passer. */
export function ressembleAUneAdresse(saisie: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(saisie.trim());
}
