import { Pressable, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Button } from "../core/Button.js";
import { chassisDeFeuille } from "./Sheet.styles.js";
import { actionsDeConfirmation } from "./ConfirmSheet.styles.js";

export interface ConfirmSheetProps {
  // Aucune chaîne dans le composant : la feuille sert les deux langues.
  titre: string;
  texte: string;
  confirmer: string;
  annuler: string;
  destructif?: boolean | undefined;
  onConfirmer?: (() => void) | undefined;
  onAnnuler?: (() => void) | undefined;
  /** Le creux du bas de l'écran — barre d'accueil ou rien. */
  insetBas?: number | undefined;
}

/* Elle se monte au-dessus de l'écran entier, jamais dedans : une feuille
   modale voile aussi l'en-tête, sinon le retour reste touchable pendant la
   question. */
export function ConfirmSheet({
  titre, texte, confirmer, annuler, destructif = false, onConfirmer, onAnnuler, insetBas,
}: ConfirmSheetProps) {
  const couleurs = useCouleurs();
  const c = chassisDeFeuille({ couleurs, ...(insetBas !== undefined ? { insetBas } : {}) });
  const a = actionsDeConfirmation({ destructif });

  return (
    <View style={c.scene}>
      {/* Le voile ferme aussi : une question qui monte doit pouvoir se
          refuser sans viser un bouton. Il porte le libellé du refus, seul
          texte que l'appel garantisse pour le dire. */}
      <Pressable
        onPress={onAnnuler}
        accessibilityRole="button"
        accessibilityLabel={annuler}
        style={c.voile}
      />
      <View style={c.feuille} accessibilityViewIsModal accessibilityLabel={titre}>
        <View style={c.poignee} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={c.titre} accessibilityRole="header">{titre}</Text>
        <Text style={c.texte}>{texte}</Text>
        <View style={c.actions}>
          <Button
            full
            variant={a.rang}
            onPress={onConfirmer}
            {...(a.signe ? { icon: a.signe } : {})}
          >
            {confirmer}
          </Button>
          <Button full variant={a.rangDuRefus} onPress={onAnnuler}>{annuler}</Button>
        </View>
      </View>
    </View>
  );
}
