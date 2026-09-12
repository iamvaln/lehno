import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import Svg, { ClipPath, Defs, G, Path, Rect } from "react-native-svg";
import { nativeEasing } from "@lehno/tokens";
import { BOITE_LOGOTYPE, LETTRES, REPERE } from "@lehno/ui-native";

/* L'ouverture. Ce n'est pas une image : le mot s'écrit de gauche à droite,
 * lettre après lettre, puis le h passe du blanc à l'abricot. Une fois par
 * lancement, jamais en boucle.
 *
 * L'aplat est violet dans les deux thèmes — un écran d'ouverture n'a pas de
 * thème, il précède l'application, et la marque ne change pas de couleur parce
 * que le téléphone est en sombre.
 *
 * Le volet qui découvre chaque lettre est un rectangle de découpe dont la
 * largeur croît depuis le bord gauche. Le web l'obtenait par un scaleX avec
 * transformOrigin ; animer la largeur donne exactement le même dessin et
 * s'anime de façon plus sûre en natif.
 *
 * `prefers-reduced-motion` coupe tout : l'état d'arrêt est exactement le
 * logotype statique, donc il n'y a rien à dessiner d'autre.
 */

const VIOLET = "#7B6BB7";
const BLANC = "#FFFFFF";
const ABRICOT = "#F0CFB4";

// La partition de la planche va jusqu'à 1,95 s : juste pour une planche, trop
// long pour un lancement qu'on n'attend pas — on le traverse. Les durées sont
// resserrées, la grammaire non : même ordre, mêmes courbes, même dernière
// lettre à se colorer.
const ECRIT = 300;
const PAS = 170;
const TEINTE = 820;
const TEINTE_DUREE = 700;
const APRES = 400;

export default function Ouverture() {
  const routeur = useRouter();
  const [sansMouvement, setSansMouvement] = useState<boolean | null>(null);
  const volets = useRef(LETTRES.map(() => new Animated.Value(0))).current;
  const teinte = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduit) => {
      if (vivant) setSansMouvement(reduit);
    });
    return () => { vivant = false; };
  }, []);

  useEffect(() => {
    if (sansMouvement === null) return;

    const suite = () => routeur.replace("/(connexion)/connexion");

    if (sansMouvement) {
      volets.forEach((v) => v.setValue(1));
      teinte.setValue(1);
      const t = setTimeout(suite, APRES);
      return () => clearTimeout(t);
    }

    const ecriture = Animated.stagger(
      PAS,
      volets.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: ECRIT,
          easing: Easing.bezier(...nativeEasing.traverse),
          useNativeDriver: false,
        }),
      ),
    );
    const coloration = Animated.sequence([
      Animated.delay(TEINTE),
      Animated.timing(teinte, {
        toValue: 1, duration: TEINTE_DUREE, easing: Easing.out(Easing.ease), useNativeDriver: false,
      }),
    ]);

    let t: ReturnType<typeof setTimeout>;
    Animated.parallel([ecriture, coloration]).start(({ finished }) => {
      if (finished) t = setTimeout(suite, APRES);
    });
    return () => clearTimeout(t);
  }, [sansMouvement, routeur, volets, teinte]);

  // Tant que le système n'a pas dit s'il réduit les animations, on ne dessine
  // rien d'animé : commencer puis couper serait pire que d'attendre un souffle.
  if (sansMouvement === null) {
    return <View style={styles.fond}><StatusBar style="light" /></View>;
  }

  const AnimatedRect = Animated.createAnimatedComponent(Rect);
  const AnimatedPath = Animated.createAnimatedComponent(Path);

  return (
    <View style={styles.fond}>
      <StatusBar style="light" />
      <Svg
        width={152}
        height={152 * (BOITE_LOGOTYPE.hauteur / BOITE_LOGOTYPE.largeur)}
        viewBox={`0 0 ${BOITE_LOGOTYPE.largeur} ${BOITE_LOGOTYPE.hauteur}`}
        accessibilityRole="image"
        accessibilityLabel="Lehno"
      >
        <G transform={`translate(${REPERE.x} ${REPERE.y}) scale(${REPERE.echelle} ${-REPERE.echelle})`}>
          {LETTRES.map((lettre, rang) => (
            <G key={rang} transform={`translate(${lettre.tx} 0)`}>
              <Defs>
                <ClipPath id={`volet-${rang}`}>
                  <AnimatedRect
                    x={lettre.volet.x}
                    y={-120}
                    height={1720}
                    width={volets[rang]!.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, lettre.volet.largeur],
                    })}
                  />
                </ClipPath>
              </Defs>
              {lettre.accent ? (
                <AnimatedPath
                  d={lettre.d}
                  clipPath={`url(#volet-${rang})`}
                  fill={teinte.interpolate({ inputRange: [0, 1], outputRange: [BLANC, ABRICOT] })}
                />
              ) : (
                <Path d={lettre.d} clipPath={`url(#volet-${rang})`} fill={BLANC} />
              )}
            </G>
          ))}
        </G>
      </Svg>
    </View>
  );
}

/* Rien d'autre. Pas de signature, pas de version, pas d'indicateur de
   chargement : l'écran dure moins longtemps qu'il n'en faut pour lire. */
const styles = StyleSheet.create({
  fond: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: VIOLET },
});
