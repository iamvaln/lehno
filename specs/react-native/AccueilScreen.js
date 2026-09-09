import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, font, size, space } from "./tokens";
import { Button } from "./Button";
import { EventCard } from "./EventCard";

/* L'accueil — un écran complet, avec ce que le kit web ne pouvait pas montrer :
 * le défilement, la zone sûre lue dans le système, le tirer-pour-rafraîchir.
 *
 * LA PHRASE D'ÉTAT est la logique la plus soignée du kit web, et c'est celle
 * qui saute le plus facilement au port. Elle vient du dictionnaire, où chaque
 * variante — aucune, une aujourd'hui, deux cette semaine, plusieurs — est
 * écrite EN ENTIER dans les deux langues. Le singulier et le pluriel ne
 * s'accordent pas pareil, donc on ne recolle pas des morceaux.
 *
 * DEUX ÉTATS VIDES distincts, comme la spec 3.2 les demande : le premier
 * lancement propose d'ajouter un anniversaire, l'accueil sans échéance proche
 * propose de laisser une note. Les confondre ferait proposer un geste inutile
 * à l'un des deux.
 *
 * Reste à trancher : « Préparer » pousse ou monte ? Voir le brief. */

export function AccueilScreen({
  t, prenom, echeances = [], etat = "nominal",
  nuit = false, onOuvrir, onRafraichir
}) {
  const c = theme(nuit);
  const insets = useSafeAreaInsets();
  const [enCours, setEnCours] = React.useState(false);

  const rafraichir = React.useCallback(async () => {
    setEnCours(true);
    try { if (onRafraichir) await onRafraichir(); } finally { setEnCours(false); }
  }, [onRafraichir]);

  const premier = etat === "premier";
  const vide = premier || etat === "vide";
  const liste = vide ? [] : echeances;
  const imminente = liste[0];
  const suivantes = liste.slice(1);

  return (
    <ScrollView
      style={{ backgroundColor: c.surfacePage }}
      contentContainerStyle={[
        styles.contenu,
        { paddingBottom: space[24] + insets.bottom }
      ]}
      refreshControl={
        <RefreshControl
          refreshing={enCours}
          onRefresh={rafraichir}
          /* tintColor n'agit que sur iOS ; Android lit colors. Les deux, donc,
             sinon la roue reste grise sur la moitié du parc. */
          tintColor={c.action}
          colors={[c.action]}
        />
      }
    >
      <Text style={[styles.salut, { color: c.textBody }]}>{t.salut(prenom)}</Text>
      <Text style={[styles.sous, { color: c.textSecondary }]}>
        {t.phraseEtat(liste)}
      </Text>

      {vide ? (
        <View style={styles.vide}>
          <Text style={[styles.videTitre, { color: c.textBody }]}>
            {premier ? t.accueilPremierTitre : t.accueilVideTitre}
          </Text>
          <Text style={[styles.videTexte, { color: c.textSecondary }]}>
            {premier ? t.accueilPremierTexte : t.accueilVideTexte}
          </Text>
          <Button variant="primary" full nuit={nuit} style={{ marginTop: space[16] }}
            onPress={() => onOuvrir && onOuvrir(premier ? "evenement" : "note")}>
            {premier ? t.ajouterDate : t.laisserNote}
          </Button>
        </View>
      ) : (
        <>
          <Text style={[styles.kicker, { color: c.textMention }]}>{t.accueilApproche}</Text>

          {imminente ? (
            <EventCard
              t={t} {...imminente} nuit={nuit} enAvant
              onPress={() => onOuvrir && onOuvrir("occasion", imminente)}
              onPreparer={() => onOuvrir && onOuvrir("preparation", imminente)}
              onMarquer={() => onOuvrir && onOuvrir("marquer", imminente)}
            />
          ) : null}

          <View style={{ gap: space[10], marginTop: space[10] }}>
            {/* L'identifiant, pas le nom : deux homonymes ou deux échéances
                d'une même personne casseraient la liste. */}
            {suivantes.map((e) => (
              <EventCard key={e.id} t={t} {...e} nuit={nuit}
                onPress={() => onOuvrir && onOuvrir("occasion", e)} />
            ))}
          </View>

          <Pressable
            onPress={() => onOuvrir && onOuvrir("note")}
            accessibilityRole="button"
            hitSlop={10}
            style={({ pressed }) => [styles.lien, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.lienTexte, { color: c.textAccent }]}>{t.laisserNote}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: space[16], paddingTop: space[6] },
  /* Toutes les tailles viennent des jetons : une valeur en dur ici est une
     valeur qui ne suivra pas la charte quand elle bougera. */
  salut: {
    fontFamily: font.displayMedium, fontSize: size.displayS,
    lineHeight: Math.round(size.displayS * 1.1), letterSpacing: -0.7
  },
  sous: {
    fontFamily: font.bodyRegular, fontSize: size.bodyXs,
    lineHeight: Math.round(size.bodyXs * 1.5),
    marginTop: space[4], marginBottom: space[16]
  },
  kicker: {
    fontFamily: font.bodySemiBold, fontSize: size.kicker,
    letterSpacing: 1.5, textTransform: "uppercase", marginBottom: space[10]
  },
  vide: { paddingTop: space[24], paddingBottom: space[16] },
  videTitre: {
    fontFamily: font.displayMedium, fontSize: size.displayXs,
    lineHeight: Math.round(size.displayXs * 1.15)
  },
  videTexte: {
    fontFamily: font.bodyRegular, fontSize: size.bodyXs,
    lineHeight: Math.round(size.bodyXs * 1.5), marginTop: space[6]
  },
  lien: { marginTop: space[16], paddingVertical: space[8] },
  lienTexte: { fontFamily: font.bodySemiBold, fontSize: size.bodyS }
});
