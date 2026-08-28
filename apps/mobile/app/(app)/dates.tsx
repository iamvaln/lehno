import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { occurrenceSchema, type Occurrence } from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace,
  nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, Countdown, EmptyState, Icon, LoadingState, SectionLabel, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import {
  JOURS_PAR_SEMAINE, decaleDeMois, echeancesParJour, fenetreDesDates,
  grilleDuMois, parMois, titreDuMois,
} from "../../lib/dates.js";
import { dateCourte } from "../../lib/carnet.js";
import { libelleDeLEcheance } from "../../lib/libelles.js";

/* Vos dates — §3.14.
 *
 * DEUX VUES DU MÊME CONTENU. La LISTE répond « qu'est-ce qui m'attend » : elle
 * se lit du plus proche au plus loin, et le décompte y est la valeur qu'on
 * cherche. Le CALENDRIER répond « comment mon mois est rempli » : c'est la
 * densité qu'on y lit, pas le détail — d'où un point, pas un aperçu.
 *
 * Elles se parcourent, donc elles DÉFILENT — contrairement à l'accueil, qu'on
 * regarde.
 *
 * RIEN NE SE MASQUE ICI. Le kit filtre l'agenda quand `events.other` est
 * éteint ; le contrat l'interdit — « le drapeau garde la création, jamais
 * l'existant ». Aucun drapeau n'est donc consulté sur cet écran.
 */
type Vue = "liste" | "calendrier";

/* Le point qui marque un jour occupé. Son rayon vaut la moitié de son côté —
   c'est un CERCLE, pas un rayon de charte : les jetons de forme décrivent des
   coins arrondis, et emprunter l'un d'eux ici ferait dépendre la rondeur d'un
   point d'une décision qui parle de cartes. */
const COTE_DU_POINT = 4;

export default function Dates() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [vue, setVue] = useState<Vue>("liste");
  const [echeances, setEcheances] = useState<Occurrence[] | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [rafraichit, setRafraichit] = useState(false);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [mois, setMois] = useState(aujourdhui.slice(0, 7));

  const charge = useCallback(async () => {
    try {
      const { from, to } = fenetreDesDates(new Date().toISOString().slice(0, 10));
      const brut = await appel<unknown>(`/me/occurrences?from=${from}&to=${to}&limit=200`);
      setEcheances(Array.isArray(brut) ? brut.map((e) => occurrenceSchema.parse(e)) : []);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { void charge(); }, [charge]);
  useFocusEffect(useCallback(() => { void charge(); }, [charge]));

  const ouvre = (e: Occurrence): void => {
    routeur.push({ pathname: "/(app)/proches/[id]", params: { id: e.personId } });
  };

  const quoi = (e: Occurrence): string =>
    `${libelleDeLEcheance(e.kind, e.label, t)} · ${dateCourte(e.occurrenceDate, langue)}`;

  return (
    <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
      <View style={styles.entete}>
        <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.datesTitre}</Text>
      </View>

      {/* Deux vues, pas un compromis : une même personne revient ici pour deux
          raisons différentes. */}
      <View style={styles.vues}>
        {(["liste", "calendrier"] as const).map((v) => {
          const actif = vue === v;
          return (
            <Pressable
              key={v}
              accessibilityRole="button"
              accessibilityState={{ selected: actif }}
              onPress={() => setVue(v)}
              style={[styles.vue, {
                borderColor: actif ? "transparent" : couleurs.borderObject,
                backgroundColor: actif ? couleurs.action : "transparent",
              }]}
            >
              <Text style={[styles.vueTexte, {
                color: actif ? couleurs.textOnAccent : couleurs.textSecondary,
              }]}>{v === "liste" ? t.vueListe : t.vueCalendrier}</Text>
            </Pressable>
          );
        })}
      </View>

      {echec ? (
        <View style={{ gap: nativeSpace[12] }}>
          <Banner intent="error">{echec}</Banner>
          <Button variant="outline" full icon="refresh-cw" onPress={() => void charge()}>
            {t.maintReessayer}
          </Button>
        </View>
      ) : echeances === null ? (
        <LoadingState variant="liste" rows={4} title={t.chargement} />
      ) : echeances.length === 0 ? (
        <EmptyState
          illustration="calendrier-sans-date"
          title={t.videDatesTitre}
          text={t.videDatesTexte}
          actionLabel={t.ajouterDate}
          onAction={() => routeur.push("/evenement")}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: nativeSpace[24] }}
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
          {vue === "liste" ? (
            parMois(echeances).map((bloc) => (
              <View key={bloc.mois} style={styles.bloc}>
                <SectionLabel>
                  {titreDuMois(bloc.mois, langue, Number(aujourdhui.slice(0, 4)))}
                </SectionLabel>
                <View style={[styles.groupe, { borderColor: couleurs.borderObject }]}>
                  {bloc.echeances.map((e, rang) => (
                    <Pressable
                      key={e.id}
                      accessibilityRole="button"
                      onPress={() => ouvre(e)}
                      style={[styles.ligne, rang ? {
                        borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
                      } : null]}
                    >
                      <View style={styles.identite}>
                        <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
                          {e.personDisplayName}
                        </Text>
                        <Text style={[styles.quoi, { color: couleurs.textSecondary }]} numberOfLines={1}>
                          {quoi(e)}
                        </Text>
                      </View>
                      <Countdown
                        size="s"
                        today={e.daysUntil === 0}
                        label={e.daysUntil === 0 ? t.aujourdhui : t.decompteBarre(e.daysUntil)}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <Calendrier
              mois={mois}
              aujourdhui={aujourdhui}
              echeances={echeances}
              langue={langue}
              onMois={setMois}
              onOuvrir={ouvre}
              quoi={quoi}
            />
          )}
        </ScrollView>
      )}

      {/* L'ajout vit en bas : c'est l'action de l'écran, et elle doit rester
          atteignable au pouce quel que soit le défilement. */}
      {echeances?.length ? (
        <View style={styles.pied}>
          <Button variant="primary" full icon="plus" onPress={() => routeur.push("/evenement")}>
            {t.ajouterDate}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function Calendrier({ mois, aujourdhui, echeances, langue, onMois, onOuvrir, quoi }: {
  mois: string;
  aujourdhui: string;
  echeances: readonly Occurrence[];
  langue: string;
  onMois: (m: string) => void;
  onOuvrir: (e: Occurrence) => void;
  quoi: (e: Occurrence) => string;
}) {
  const { t } = useLangue();
  const couleurs = useCouleurs();
  const [choisi, setChoisi] = useState<number | null>(null);

  const parJour = echeancesParJour(echeances, mois);
  const cases = grilleDuMois(mois);
  const jourDuMois = aujourdhui.startsWith(mois) ? Number(aujourdhui.slice(8, 10)) : null;
  const retenues = choisi === null ? [] : parJour.get(choisi) ?? [];

  const change = (pas: number): void => {
    onMois(decaleDeMois(`${mois}-01`, pas).slice(0, 7));
    setChoisi(null);
  };

  return (
    <View>
      <View style={styles.navMois}>
        <Pressable accessibilityRole="button" onPress={() => change(-1)} style={styles.fleche}>
          <Icon name="chevron-left" size={20} color={couleurs.textBody} />
        </Pressable>
        <Text style={[styles.moisTitre, { color: couleurs.textBody }]}>
          {titreDuMois(mois, langue, Number(aujourdhui.slice(0, 4)))}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => change(1)} style={styles.fleche}>
          <Icon name="chevron-right" size={20} color={couleurs.textBody} />
        </Pressable>
      </View>

      <View style={styles.semaine}>
        {t.joursCourts.map((j, i) => (
          <Text key={i} style={[styles.jourCourt, { color: couleurs.textMention }]}>{j}</Text>
        ))}
      </View>

      <View style={styles.grille}>
        {cases.map((jour, i) => {
          if (jour === null) return <View key={`v${i}`} style={styles.caseVide} />;
          const porte = parJour.has(jour);
          const cejour = jour === jourDuMois;
          const actif = jour === choisi;
          return (
            <Pressable
              key={jour}
              accessibilityRole="button"
              onPress={() => setChoisi(jour)}
              style={[styles.case, {
                backgroundColor: cejour ? couleurs.celebrate
                  : actif ? couleurs.actionQuietBg : "transparent",
              }]}
            >
              <Text style={[styles.caseJour, {
                color: cejour ? couleurs.onCelebrate
                  : actif ? couleurs.textAccent : couleurs.textBody,
                fontFamily: porte ? nativeFont.bodyBold : nativeFont.bodyRegular,
              }]}>{jour}</Text>
              {/* Un POINT, pas un aperçu : à cette taille c'est la densité du
                  mois qu'on lit, et un libellé y serait illisible. */}
              <View style={[styles.point, {
                backgroundColor: porte
                  ? (cejour ? couleurs.onCelebrate : couleurs.action)
                  : "transparent",
              }]} />
            </Pressable>
          );
        })}
      </View>

      {!aujourdhui.startsWith(mois) ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => { onMois(aujourdhui.slice(0, 7)); setChoisi(null); }}
          style={styles.retour}
        >
          <Icon name="corner-up-left" size={14} strokeWidth={2} color={couleurs.textAccent} />
          <Text style={[styles.retourTexte, { color: couleurs.textAccent }]}>{t.moisCourant}</Text>
        </Pressable>
      ) : null}

      {/* La grille dit COMBIEN, le panneau dit QUI. */}
      <View style={styles.panneau}>
        {choisi === null ? null : retenues.length === 0 ? (
          <Text style={[styles.rien, { color: couleurs.textMention }]}>{t.calendrierRien}</Text>
        ) : retenues.map((e) => (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            onPress={() => onOuvrir(e)}
            style={[styles.retenue, { borderColor: couleurs.borderObject }]}
          >
            <View style={styles.identite}>
              <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
                {e.personDisplayName}
              </Text>
              <Text style={[styles.quoi, { color: couleurs.textSecondary }]} numberOfLines={1}>
                {quoi(e)}
              </Text>
            </View>
            <Icon name="chevron-right" size={15} color={couleurs.textMention} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: nativeSpace[16] },
  entete: { marginBottom: nativeSpace[16] },
  titre: {
    fontFamily: nativeFont.displayMedium, fontSize: 27,
    letterSpacing: nativeLetterSpacing(27, nativeTracking.display),
  },
  vues: { flexDirection: "row", gap: nativeSpace[8], marginBottom: nativeSpace[16] },
  vue: {
    paddingVertical: nativeSpace[6], paddingHorizontal: nativeSpace[14],
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width,
  },
  vueTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 12.5 },
  bloc: { marginBottom: nativeSpace[16] },
  groupe: {
    borderWidth: nativeBorder.width, borderRadius: nativeRadius.lg,
    overflow: "hidden", marginTop: nativeSpace[8],
  },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingVertical: nativeSpace[12], paddingHorizontal: nativeSpace[14],
    minHeight: nativeTouchMin,
  },
  identite: { flex: 1, minWidth: 0 },
  nom: { fontFamily: nativeFont.displayRegular, fontSize: 16 },
  quoi: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: 2 },
  navMois: { flexDirection: "row", alignItems: "center", marginBottom: nativeSpace[8] },
  fleche: {
    width: nativeTouchMin, height: nativeTouchMin,
    alignItems: "center", justifyContent: "center",
  },
  moisTitre: { flex: 1, textAlign: "center", fontFamily: nativeFont.displayRegular, fontSize: 17 },
  semaine: { flexDirection: "row", marginBottom: nativeSpace[2] },
  jourCourt: {
    flex: 1, textAlign: "center", fontFamily: nativeFont.bodySemibold, fontSize: 10.5,
  },
  grille: { flexDirection: "row", flexWrap: "wrap" },
  caseVide: { width: `${100 / JOURS_PAR_SEMAINE}%`, aspectRatio: 1.25 },
  case: {
    width: `${100 / JOURS_PAR_SEMAINE}%`, aspectRatio: 1.25,
    alignItems: "center", justifyContent: "center", gap: 3,
    borderRadius: nativeRadius.xs,
  },
  caseJour: { fontSize: 13 },
  point: {
    width: COTE_DU_POINT, height: COTE_DU_POINT, borderRadius: COTE_DU_POINT / 2,
  },
  retour: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[6],
    minHeight: nativeTouchMin,
  },
  retourTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
  panneau: { minHeight: nativeTouchMin, marginTop: nativeSpace[8] },
  rien: { fontFamily: nativeFont.bodyRegular, fontSize: 13 },
  retenue: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    padding: nativeSpace[12], borderRadius: nativeRadius.lg,
    borderWidth: nativeBorder.width, minHeight: nativeTouchMin,
  },
  pied: { paddingVertical: nativeSpace[12] },
});
