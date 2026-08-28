import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { homeSchema, type Home, type Occurrence } from "@lehno/contracts";
import {
  nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, EmptyState, EventCard, LoadingState, SectionLabel, Toast, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { preparationOuverte } from "../../lib/navigation.js";
import {
  REMPLISSAGE_PLEIN, composeLAccueil, doitRepartirDuMaximum, etatDeLAccueil,
  retrecit, type Remplissage,
} from "../../lib/accueil.js";
import { dateCourte } from "../../lib/carnet.js";
import { libelleDeLEcheance } from "../../lib/libelles.js";

/* L'accueil — §3.2.
 *
 * IL NE DÉFILE PAS. C'est un écran qu'on regarde, pas qu'on parcourt : il se
 * remplit à la hauteur MESURÉE, et ce qui n'y tient pas s'en va — jamais en
 * silence, le lien vers Dates porte le compte.
 *
 * Mesurer plutôt que calculer : les marges, les filets et la hauteur d'une
 * ligne changent avec la langue et le modèle, et une constante finit toujours
 * par rogner un rang.
 *
 * Le tirer-pour-rafraîchir vaut ici : ce que l'écran montre change avec
 * l'horloge, et un décompte périmé ment sur la seule chose que le produit
 * promet.
 */
export default function Accueil() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const { actives } = useDrapeaux();
  const routeur = useRouter();

  const [home, setHome] = useState<Home | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [rafraichit, setRafraichit] = useState(false);
  const [envoyes, setEnvoyes] = useState<Record<string, true>>({});
  const [accuse, setAccuse] = useState<string | null>(null);

  /* Le remplissage ne se calcule pas, il se mesure — et la mesure NE FAIT QUE
     RÉTRÉCIR. Repartir du maximum à chaque rendu faisait osciller les deux
     gestes l'un contre l'autre, sans fin. */
  const [remplissage, setRemplissage] = useState<Remplissage>(REMPLISSAGE_PLEIN);
  const [hauteur, setHauteur] = useState<number | null>(null);

  const charge = useCallback(async () => {
    try {
      setHome(homeSchema.parse(await appel<unknown>("/me/home")));
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { void charge(); }, [charge]);
  // Au retour d'un autre onglet : une date ajoutée ailleurs doit se voir ici.
  useFocusEffect(useCallback(() => { void charge(); }, [charge]));

  if (echec) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <Banner intent="error">{echec}</Banner>
        <View style={{ marginTop: nativeSpace[12] }}>
          <Button variant="outline" full icon="refresh-cw" onPress={() => void charge()}>
            {t.maintReessayer}
          </Button>
        </View>
      </View>
    );
  }

  if (!home) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const etat = etatDeLAccueil(home);
  const { cartes, rangs, reste } = composeLAccueil(
    home.occurrences, remplissage, home.remainingOccurrences,
  );
  const preparer = preparationOuverte(actives);

  /* Le carnet neuf ne poursuit qu'UN BUT : conduire au premier ajout.
     « Laisser une note » céderait la place — il n'y a personne à propos de qui
     écrire. C'est `hasPersons` qui distingue les deux vides. */
  if (etat === "premier") {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        <EmptyState
          illustration="carnet-neuf"
          title={t.videCarnetTitre}
          text={t.videCarnetTexte}
          actionLabel={t.ajouterAnniversaire}
          onAction={() => routeur.push("/evenement")}
        />
      </View>
    );
  }

  const quoi = (e: Occurrence): string => [
    libelleDeLEcheance(e.kind, e.label, t),
    dateCourte(e.occurrenceDate, langue),
  ].join(" · ");

  const decompte = (e: Occurrence): string =>
    e.daysUntil === 0 ? t.aujourdhui : t.decompteBarre(e.daysUntil);

  return (
    <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
      <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.salut(home.firstName)}</Text>

      {etat === "vide" ? (
        <>
          <EmptyState illustration="rien-approche" title={t.videRienTitre} text={t.videRienTexte} />
          {/* Le carnet est rempli, mais rien n'approche : la note demeure, et
              c'est tout ce que l'écran a à proposer. Sans proche désigné — on
              le choisit dans la feuille. */}
          <View style={styles.pied}>
            <Button variant="primary" full icon="plus" onPress={() => routeur.push("/note")}>
              {t.laisserNote}
            </Button>
          </View>
        </>
      ) : (
        <>
          <View style={styles.entete}>
            <SectionLabel>{t.ceQuiApproche}</SectionLabel>
            {/* « Voir plus » quand il en reste, « Voir tout » sinon. Le compte
                vient du serveur : `/me/home` ne rend que les plus proches, et
                sans `remainingOccurrences` ce lien aurait toujours dit « tout »
                alors qu'il en manquait vingt.

                Il mène à Dates, la même liste en entier. */}
            <Text
              accessibilityRole="button"
              onPress={() => routeur.push("/(app)/dates")}
              style={[styles.voir, { color: couleurs.textAccent }]}
            >
              {reste ? t.voirPlus : t.voirTout}
            </Text>
          </View>

          {/* La zone mesurée. `onLayout` donne la hauteur disponible,
              `onContentSizeChange` celle du contenu : c'est le couple que le
              kit lit en `clientHeight` / `scrollHeight`, et il n'existe pas
              autrement en natif. */}
          <ScrollView
            scrollEnabled={false}
            style={styles.zone}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (doitRepartirDuMaximum(h, hauteur)) setRemplissage(REMPLISSAGE_PLEIN);
              setHauteur(h);
            }}
            onContentSizeChange={(_, hContenu) => {
              if (hauteur !== null && hContenu > hauteur) {
                const moins = retrecit(remplissage);
                if (moins) setRemplissage(moins);
              }
            }}
            refreshControl={
              <RefreshControl
                refreshing={rafraichit}
                onRefresh={() => {
                  setRafraichit(true);
                  void charge().finally(() => setRafraichit(false));
                }}
                tintColor={couleurs.textMention}
              />
            }
          >
            {cartes.map((e, rang) => (
              <View key={e.id} style={{ marginBottom: nativeSpace[12] }}>
                <EventCard
                  name={e.personDisplayName}
                  what={quoi(e)}
                  countdownLabel={decompte(e)}
                  today={e.daysUntil === 0}
                  featured={rang === 0}
                  {...(rang === 0 && preparer && !envoyes[e.id] ? {
                    /* « Marquer envoyé » ne mène à aucun écran : c'est un état
                       qui change ici, et l'accusé dit à qui. La carte cesse
                       ensuite de le proposer — rien ne s'envoie deux fois. */
                    markSentLabel: t.marquerEnvoye,
                    onMarkSent: () => {
                      setEnvoyes((v) => ({ ...v, [e.id]: true }));
                      setAccuse(t.envoiFait(e.personDisplayName));
                    },
                  } : {})}
                />
              </View>
            ))}

            {rangs.map((e) => (
              <View key={e.id} style={[styles.rang, { borderTopColor: couleurs.borderHairline }]}>
                <Text style={[styles.rangNom, { color: couleurs.textBody }]} numberOfLines={1}>
                  {e.personDisplayName}
                </Text>
                <Text style={[styles.rangQuoi, { color: couleurs.textSecondary }]} numberOfLines={1}>
                  {quoi(e)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {accuse ? <Toast intent="success" onDismiss={() => setAccuse(null)}>{accuse}</Toast> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: nativeSpace[16] },
  titre: {
    fontFamily: nativeFont.displayMedium, fontSize: 27,
    letterSpacing: nativeLetterSpacing(27, nativeTracking.display),
    marginBottom: nativeSpace[16],
  },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: nativeSpace[12] },
  voir: {
    marginLeft: "auto", fontFamily: nativeFont.bodyRegular, fontSize: 13,
    minHeight: nativeTouchMin, textAlignVertical: "center", lineHeight: nativeTouchMin,
  },
  // La zone se borne à ce qui reste : c'est elle qu'on mesure, pas la page.
  zone: { flex: 1 },
  rang: { paddingVertical: nativeSpace[10], borderTopWidth: 1 },
  rangNom: { fontFamily: nativeFont.displayRegular, fontSize: 16 },
  rangQuoi: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: 2 },
  pied: { marginTop: "auto", paddingTop: nativeSpace[20] },
});
