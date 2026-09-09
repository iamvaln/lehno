import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { theme, font, size, radius, touchMin, space } from "./tokens";
import { Button } from "./Button";

/* La carte d'échéance — la brique la plus réutilisée du kit.
 *
 * AUCUNE COPY ICI. Le décompte vient de t.decompte(jours) : la règle du projet
 * est que chaque langue s'écrit en entier dans le dictionnaire, et « J− » collé
 * à un nombre est exactement le recollage de morceaux que la spec interdit.
 * Le pluriel anglais et le français ne s'accordent pas pareil.
 *
 * La carte la plus imminente porte DEUX ACTIONS VISIBLES — préparer, marquer
 * envoyé — parce que c'est celle sur laquelle on agit. Les suivantes restent
 * des lignes calmes : « ce qui est rare vit ailleurs ».
 *
 * Une carte Lehno se dessine par une bordure et un fond, jamais par une ombre —
 * d'autant qu'ici l'ombre diverge entre iOS et Android. */

export function EventCard({
  t, id, nom, quoi, jours, onPress, onPreparer, onMarquer,
  nuit = false, enAvant = false
}) {
  const c = theme(nuit);
  const jourMeme = jours === 0;

  return (
    <View style={[
      styles.enveloppe,
      {
        backgroundColor: enAvant ? c.surfacePanel : c.surfaceCard,
        borderColor: enAvant ? "transparent" : c.borderObject
      }
    ]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={nom + ", " + quoi + ", " + t.decompte(jours)}
        style={({ pressed }) => [styles.ligne, { opacity: pressed ? 0.72 : 1 }]}
      >
        <View style={styles.texte}>
          <Text style={[styles.nom, { color: c.textBody }]} numberOfLines={1}>{nom}</Text>
          <Text style={[styles.quoi, { color: c.textSecondary }]} numberOfLines={1}>{quoi}</Text>
        </View>

        {jourMeme ? (
          <View style={[styles.pilule, { backgroundColor: c.celebrate }]}>
            <Text style={[styles.piluleTexte, { color: c.onCelebrate }]}>{t.decompte(0)}</Text>
          </View>
        ) : (
          <Text style={[styles.decompte, { color: c.textAccent }]}>{t.decompte(jours)}</Text>
        )}
      </Pressable>

      {/* Les deux actions de la carte imminente. Un seul bouton plein : celui
          qui fait avancer. */}
      {enAvant ? (
        <View style={styles.actions}>
          <Button variant="primary" full nuit={nuit} onPress={onPreparer}>
            {t.preparer}
          </Button>
          <Button variant="text" full nuit={nuit} onPress={onMarquer}>
            {t.marquerEnvoye}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  enveloppe: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    minHeight: touchMin,
    paddingVertical: 14,
    paddingHorizontal: 15
  },
  /* flexShrink, pas minWidth: 0 — c'est ce qui empêche un nom long de pousser
     le décompte hors de la carte. */
  texte: { flex: 1, flexShrink: 1 },
  nom: {
    fontFamily: font.displayMedium,
    fontSize: size.displayXs,
    lineHeight: Math.round(size.displayXs * 1.15),
    letterSpacing: -0.3
  },
  quoi: {
    fontFamily: font.bodyRegular,
    fontSize: size.bodyXs,
    lineHeight: Math.round(size.bodyXs * 1.4),
    marginTop: 1
  },
  decompte: {
    fontFamily: font.displayRegular,
    fontSize: size.displayXs,
    lineHeight: Math.round(size.displayXs * 1.1),
    letterSpacing: -0.5
  },
  pilule: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: radius.pill },
  piluleTexte: { fontFamily: font.bodySemiBold, fontSize: 12 },
  actions: {
    gap: space[6],
    paddingHorizontal: 15,
    paddingBottom: 14,
    paddingTop: space[2]
  }
});
