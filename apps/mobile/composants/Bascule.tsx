import { StyleSheet, Switch, Text, View } from "react-native";
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import { useCouleurs } from "@lehno/ui-native";

/* Une ligne à interrupteur.
 *
 * `Switch` natif plutôt qu'un dessin à nous : c'est un contrôle que le système
 * rend accessible, animé et lisible au doigt sans qu'on ait rien à faire — et
 * dont chacun connaît déjà le sens. Le kit dessine un `Interrupteur` maison,
 * mais ses primitives n'ont jamais été livrées : entre le reconstruire de
 * mémoire et employer celui du système, le second dit vrai.
 *
 * PAS DE BASCULE SANS EFFET : quand rien ne peut être réglé, la ligne ne
 * s'affiche pas — c'est l'appelant qui décide, jamais ce composant en se
 * grisant.
 */
export function Bascule({ libelle, actif, premier = false, onBascule }: {
  libelle: string;
  actif: boolean;
  premier?: boolean;
  onBascule: (valeur: boolean) => void;
}) {
  const couleurs = useCouleurs();
  return (
    <View
      style={[styles.rang, premier ? null : {
        borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
      }]}
    >
      <Text style={[styles.libelle, { color: couleurs.textBody }]}>{libelle}</Text>
      <Switch
        value={actif}
        onValueChange={onBascule}
        accessibilityLabel={libelle}
        trackColor={{ false: couleurs.borderObject, true: couleurs.action }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingVertical: nativeSpace[10], minHeight: nativeTouchMin,
  },
  libelle: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
});
