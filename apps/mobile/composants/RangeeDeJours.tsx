import { useRef } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { nativeSpace } from "@lehno/tokens";
import { Pastille } from "./Pastille.js";

const JOURS_DU_MOIS_MAX = 31;

/* LES JOURS D'UN MOIS, et la rangée se porte sur celui qui est choisi.
 *
 * Elle ne défilait pas : le jour retenu — aujourd'hui, par défaut — restait
 * HORS CHAMP dès le 9 du mois. On voyait « 1 2 3 4 5 6 7 8 », aucun en
 * évidence, sous un bouton d'enregistrement pourtant actif : la rangée avait
 * l'air vide et le formulaire l'air prêt, ce qui ne s'explique pas.
 *
 * On mesure la pastille active plutôt que de calculer sa position : sa largeur
 * dépend du texte, des jetons d'espacement et de la police. Un calcul viserait
 * juste aujourd'hui et à côté à la première retouche de la charte.
 *
 * UNE SEULE FOIS, au premier passage : défiler à chaque changement de jour
 * arracherait la rangée sous le doigt de quelqu'un en train de la parcourir.
 */
export function RangeeDeJours({ jours, actif, choisit }: {
  jours?: readonly number[] | undefined;
  actif: number | null;
  choisit: (jour: number) => void;
}) {
  const rangee = useRef<ScrollView>(null);
  const porte = useRef(false);
  const liste = jours ?? Array.from({ length: JOURS_DU_MOIS_MAX }, (_, i) => i + 1);

  return (
    <ScrollView
      ref={rangee}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.rangee}
    >
      {liste.map((j) => (
        <Pastille
          key={j}
          actif={actif === j}
          libelle={String(j)}
          appuie={() => choisit(j)}
          {...(actif === j ? {
            surLaMise: (x: number, largeur: number) => {
              if (porte.current) return;
              porte.current = true;
              /* Un peu avant la pastille, pas dessus : posée au ras du bord
                 gauche, elle a l'air d'être la première de la rangée et l'on ne
                 devine pas qu'il y en a avant. */
              rangee.current?.scrollTo({ x: Math.max(0, x - largeur), animated: false });
            },
          } : {})}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: "row", gap: nativeSpace[6], paddingTop: nativeSpace[8] },
});
