import { Pressable, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Button } from "../core/Button.js";
import { SectionLabel } from "../core/SectionLabel.js";
import { CreditIndicator } from "../content/CreditIndicator.js";
import { chassisDeFeuille } from "./Sheet.styles.js";
import { actionPrincipale, styleDeFeuillePayante } from "./PaidActionSheet.styles.js";

export interface PaidActionSheetProps {
  /* AUCUNE CHAÎNE DANS LE COMPOSANT. « crédit » / « crédits » s'accorde en
     français, pas en anglais : les libellés arrivent déjà accordés. */
  surTitre: string;
  titre: string;
  /** Ce que l'utilisateur obtient — en une phrase, au concret. */
  resultat: string;
  /** Le coût, déjà accordé : « 1 crédit », « 2 crédits ». */
  coutLibelle: string;
  /** Le solde, déjà accordé : « il vous en reste 4 ». */
  soldeLibelle: string;
  lancer: string;
  recharger: string;
  pasMaintenant: string;
  /* LE COÛT EST OBLIGATOIRE, et il n'a pas de valeur par défaut.
     
     Il en a porté une — `1` —, et c'était un prix écrit dans le client. Le
     tarif se règle en administration sans livraison : un appelant qui oublie
     de passer celui que le serveur sert annoncerait l'ancien, et déciderait
     « Lancer » ou « Recharger » sur un chiffre que personne n'a servi.
     
     Le rendre obligatoire fait porter la garde au compilateur : on ne peut
     plus ouvrir cette feuille sans dire ce qu'elle coûte. */
  cout: number;
  solde?: number | undefined;
  onConfirmer?: (() => void) | undefined;
  onRecharger?: (() => void) | undefined;
  onAnnuler?: (() => void) | undefined;
  insetBas?: number | undefined;
}

export function PaidActionSheet({
  surTitre, titre, resultat, coutLibelle, soldeLibelle,
  lancer, recharger, pasMaintenant,
  cout, solde = 0, onConfirmer, onRecharger, onAnnuler, insetBas,
}: PaidActionSheetProps) {
  const couleurs = useCouleurs();
  const c = chassisDeFeuille({ couleurs, ...(insetBas !== undefined ? { insetBas } : {}) });
  const s = styleDeFeuillePayante(couleurs);
  const action = actionPrincipale({ cout, solde });

  return (
    <View style={c.scene}>
      {/* Rien n'a encore commencé : le voile referme la feuille comme le
          refus, et porte son libellé. */}
      <Pressable
        onPress={onAnnuler}
        accessibilityRole="button"
        accessibilityLabel={pasMaintenant}
        style={c.voile}
      />
      <View style={c.feuille} accessibilityViewIsModal accessibilityLabel={titre}>
        <View style={c.poignee} accessibilityElementsHidden importantForAccessibility="no" />
        <SectionLabel>{surTitre}</SectionLabel>
        <Text style={[c.titre, s.titre]} accessibilityRole="header">{titre}</Text>
        <Text style={s.resultat}>{resultat}</Text>

        {/* Ce que ça coûte à gauche, ce qu'il reste à droite : les deux se
            comparent d'un coup d'œil, sans lire deux phrases. */}
        <View style={s.ligneDuCout}>
          <Text style={s.cout}>{coutLibelle}</Text>
          <CreditIndicator label={soldeLibelle} balance={solde} cost={cout} />
        </View>

        <View style={c.actions}>
          {action === "lancer" ? (
            <Button full onPress={onConfirmer}>{lancer}</Button>
          ) : (
            <Button full onPress={onRecharger}>{recharger}</Button>
          )}
          <Button full variant="text" onPress={onAnnuler}>{pasMaintenant}</Button>
        </View>
      </View>
    </View>
  );
}
