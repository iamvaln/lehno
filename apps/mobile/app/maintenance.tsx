import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import { Button, Wordmark, useTheme } from "@lehno/ui-native";
import { useLangue } from "../lib/langue.js";
import { useArret } from "../lib/ArretProvider.js";
import { heureDeRetour } from "../lib/arret.js";

/* L'arrêt pour intervention.
 *
 * IL N'EXPLIQUE PAS, IL OCCUPE LE TEMPS. Une page de maintenance qui détaille
 * l'incident demande à l'utilisateur de s'intéresser à nos affaires. Elle dit
 * ce qui se passe en une ligne, l'heure de retour quand on la connaît, et donne
 * quelque chose à regarder pendant ce temps-là.
 *
 * L'ANIMATION EST UN MOIS QUI SE REMPLIT — la grille d'un calendrier, une vague
 * diagonale qui allume les cases puis les laisse retomber, et une seule case
 * qui garde l'abricot : le jour J. Le vocabulaire de Lehno est le temps qui
 * avance, pas un sablier ni un spinner.
 *
 * PAS DE BOUTON PRINCIPAL. Réessayer est un geste en contour : le résultat ne
 * dépend pas de l'utilisateur, et un bouton pleine teinte promettrait le
 * contraire.
 */

const COLONNES = 7;
const LIGNES = 5;
const JOUR = 24;
const COTE = 14;
const BOUCLE = 4600;
const PAS = 180;

export default function Maintenance() {
  const { t, langue } = useLangue();
  const { theme, couleurs } = useTheme();
  const insets = useSafeAreaInsets();
  const { secondes, reessaie } = useArret();
  /* MAINTENANT plus LE RESTE, à chaque rendu. La somme ne bouge pas — le
     décompte perd une seconde pendant que l'horloge en gagne une —, et l'heure
     annoncée tient. Figer l'instant de départ l'aurait fait reculer d'une
     seconde par seconde sous les yeux de qui attend. */
  const heure = heureDeRetour(secondes, Date.now(), langue);

  const [sansMouvement, setSansMouvement] = useState<boolean | null>(null);
  /* Une horloge par case, décalée à son propre retard. J'avais d'abord voulu
     une horloge unique et des seuils décalés : les seuils se déplaçaient, mais
     pas les valeurs qu'ils encadrent, et la vague partait déphasée. Trente-cinq
     valeurs pilotées par la même boucle native ne dérivent pas — c'est le
     décalage qui doit vivre dans le départ, pas dans l'interpolation. */
  const horloges = useRef(
    Array.from({ length: COLONNES * LIGNES }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduit) => {
      if (vivant) setSansMouvement(reduit);
    });
    return () => { vivant = false; };
  }, []);

  useEffect(() => {
    if (sansMouvement !== false) return;
    const boucles = horloges.map((horloge, i) =>
      Animated.loop(
        Animated.sequence([
          // La vague est diagonale : le retard suit la somme ligne + colonne.
          Animated.delay(retardDe(i)),
          Animated.timing(horloge, {
            toValue: 1, duration: BOUCLE, easing: Easing.linear, useNativeDriver: true,
          }),
          Animated.timing(horloge, {
            toValue: 0, duration: 0, useNativeDriver: true,
          }),
        ]),
      ),
    );
    boucles.forEach((b) => b.start());
    return () => boucles.forEach((b) => b.stop());
  }, [sansMouvement, horloges]);

  return (
    <View style={[styles.page, {
      backgroundColor: couleurs.surfacePage,
      paddingTop: insets.top + nativeSpace[28],
      paddingBottom: insets.bottom + nativeSpace[24],
    }]}>
      {/* Le logotype passe en blanc en thème sombre : la variante inverse porte
          sa plaque d'encre et ferait un rectangle au milieu de la page. */}
      <View style={styles.marque}>
        <Wordmark variant={theme === "dark" ? "blanc" : "couleur"} height={22} />
      </View>

      <View style={styles.grille} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {horloges.map((horloge, i) => {
          const estLeJour = i === JOUR;
          /* Les cases tirent leur teinte de l'action et leur intensité de
             l'opacité : un fond fixe se perdait sur la page sombre. */
          const opacite = sansMouvement
            ? 0.3
            : horloge.interpolate({
              inputRange: SEUILS,
              outputRange: estLeJour ? [1, 1, 1, 1] : [0.22, 0.85, 0.22, 0.22],
            });
          const echelle = sansMouvement
            ? 1
            : horloge.interpolate({
              inputRange: SEUILS,
              outputRange: estLeJour ? [1, 1.28, 1, 1] : [1, 1.12, 1, 1],
            });
          return (
            <Animated.View
              key={i}
              style={{
                width: COTE,
                height: COTE,
                borderRadius: estLeJour ? COTE / 2 : 4,
                backgroundColor: estLeJour ? couleurs.celebrate : couleurs.action,
                opacity: opacite,
                transform: [{ scale: echelle }],
              }}
            />
          );
        })}
      </View>

      <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.maintTitre}</Text>
      <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
        {/* L'heure se CALCULE depuis le délai du serveur, et ne paraît qu'au-delà
            d'un quart d'heure. Sans elle, on dit seulement qu'une mise à jour est
            en cours : pas de « bientôt », pas d'estimation inventée. */}
        {heure ? t.maintHeure(heure) : t.maintTexte}
      </Text>

      <View style={styles.sorties}>
        <Button variant="outline" full icon="refresh-cw" onPress={reessaie}>
          {t.maintReessayer}
        </Button>
        <Text style={[styles.lien, { color: couleurs.textMention }]}>{t.maintEtat}</Text>
      </View>
    </View>
  );
}

/* La partition, identique pour toutes les cases : allumage au premier quart,
   retour à l'ombre avant la moitié, puis attente. Seul le DÉPART diffère. */
const SEUILS = [0, 0.22, 0.48, 1];

function retardDe(indice: number): number {
  return (Math.floor(indice / COLONNES) + (indice % COLONNES)) * PAS;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", paddingHorizontal: nativeSpace[24] },
  marque: { marginBottom: "auto", opacity: 0.9 },
  grille: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: COLONNES * COTE + (COLONNES - 1) * nativeSpace[10],
    gap: nativeSpace[10],
    marginBottom: nativeSpace[28],
  },
  titre: {
    fontFamily: nativeFont.displayMedium, fontSize: 27, textAlign: "center",
    letterSpacing: nativeLetterSpacing(27, nativeTracking.display),
  },
  texte: {
    fontFamily: nativeFont.bodyRegular, fontSize: 14.5, textAlign: "center",
    lineHeight: 22, marginTop: nativeSpace[10],
  },
  sorties: { marginTop: "auto", alignSelf: "stretch", gap: nativeSpace[12] },
  lien: {
    fontFamily: nativeFont.bodyRegular, fontSize: 13, textAlign: "center",
    minHeight: nativeTouchMin, textAlignVertical: "center", lineHeight: nativeTouchMin,
  },
});
