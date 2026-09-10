import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import {
  generationsSchema, occurrenceSchema, type GenerationResult, type Occurrence,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSpace,
} from "@lehno/tokens";
import {
  Banner, Button, Card, Countdown, EmptyState, Icon, LoadingState, Quote, ScreenHeader,
  useCouleurs
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { ecranEteint } from "../../lib/navigation.js";
import {
  composeLesReprises, destinationDeLaReprise, fenetreDesReprises, type Reprise,
} from "../../lib/reprises.js";
import { EcranFerme } from "../../composants/EcranFerme.js";

/* Reprises en cours — §3.16.
 *
 * L'écran existe pour tenir une promesse : rien ne se perd. Ce qu'on a lancé et
 * laissé en plan se retrouve ici, du plus urgent au moins urgent.
 *
 * TOUT CE QUI SE DÉCIDE VIT DANS `lib/reprises.ts` — le tri, le filtre des
 * drapeaux, la jointure avec l'échéance visée, la coupe de l'extrait. Ici il ne
 * reste qu'à dessiner : c'est ce qui rend ces décisions éprouvables, `react-native`
 * étant typé en Flow et illisible pour nos outils de test.
 *
 * DEUX APPELS, et le second n'est pas un luxe. `/me/generations` ne dit pas ce
 * qu'une exécution vise : le contrat ne le porte qu'à travers le résultat
 * (`message.occurrenceId`). Sans `/me/occurrences`, la liste ne saurait ni pour
 * qui ni pour quand — et le tri de §3.16 est un tri par urgence.
 */

/* La pastille de nature. Un CARRÉ de 32, pas une valeur d'espacement : c'est la
   taille d'un ornement, et l'emprunter à l'échelle des marges ferait dépendre
   son dessin d'une décision qui parle de rythme. */
const COTE_DE_LA_PASTILLE = 32;

/* OÙ MÈNE « REPRENDRE » : `destinationDeLaReprise`, hors de React.
 *
 * Le chemin poussé ne figure pas dans les routes typées d'expo-router — les
 * deux écrans d'arrivée vivent hors du groupe `(app)` —, d'où la conversion.
 * C'est la même que celle de l'occasion et de la préparation, qui poussent
 * `/generation` de la même façon. */

interface Charge {
  generations: readonly GenerationResult[];
  echeances: readonly Occurrence[];
}

export default function Reprises() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();

  /* La règle du dépôt, pas une seconde écrite ici : les reprises tiennent tant
     qu'une seule production est possible — message, idées ou portrait. Deux
     listes finiraient par diverger. */
  const eteint = ecranEteint("reprises", actives);

  const [charge, setCharge] = useState<Charge | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [rafraichit, setRafraichit] = useState(false);

  const demande = useCallback(async () => {
    /* Aucune nature ouverte : l'écran se replie sur son état vide sans appeler.
       Le chemin est gouverné, il rendrait 404, et faire relire les drapeaux
       pour apprendre ce qu'on sait déjà serait un aller-retour pour rien. */
    if (eteint) {
      setCharge({ generations: [], echeances: [] });
      setEchec(null);
      return;
    }
    try {
      const { from, to } = fenetreDesReprises(new Date().toISOString().slice(0, 10));
      const [brutes, brutEcheances] = await Promise.all([
        /* GOUVERNÉE : sur ce chemin, un 404 ne dit pas « rien à cet endroit »
           mais « la nature a été éteinte depuis votre dernière lecture ». Les
           drapeaux se relisent, et l'écran disparaît de lui-même — ce qui est
           la vérité — au lieu d'afficher une erreur. */
        appel<unknown>("/me/generations", { gouvernee: true }),
        appel<unknown>(`/me/occurrences?from=${from}&to=${to}&limit=200`),
      ]);
      setCharge({
        generations: generationsSchema.parse(brutes).generations,
        echeances: Array.isArray(brutEcheances)
          ? brutEcheances.map((e) => occurrenceSchema.parse(e))
          : [],
      });
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [eteint, langue]);

  useEffect(() => { void demande(); }, [demande]);
  // On revient d'une génération qu'on vient de reprendre : la liste doit avoir
  // bougé. La relire au retour vaut mieux que de montrer ce qu'on a fini.
  useFocusEffect(useCallback(() => { void demande(); }, [demande]));

  const liste = useMemo(
    () => (charge === null ? null : composeLesReprises(charge.generations, charge.echeances, actives)),
    [charge, actives],
  );

  /* FERMÉ, PAS VIDE. L'écran se repliait sur son état vide — « rien à
     reprendre » — et c'était une demi-vérité : ce n'est pas qu'on n'a rien
     produit, c'est qu'on ne peut plus rien produire. Un état vide INVITE, il
     montre le geste qui le remplirait ; ici tous ces gestes sont fermés, et
     l'invitation ne mène qu'à des murs. */
  if (eteint) return <EcranFerme />;

  return (
    <View style={[styles.page, { paddingTop: insets.top + nativeSpace[12] }]}>
      <ScreenHeader titre={t.enteteReprises} retour={t.retour} onRetour={() => routeur.back()} />

      {echec ? (
        <View style={styles.panne}>
          <Banner intent="error">{echec}</Banner>
          <Button variant="outline" full icon="refresh-cw" onPress={() => void demande()}>
            {t.maintReessayer}
          </Button>
        </View>
      ) : liste === null ? (
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      ) : liste.length === 0 ? (
        /* L'état vide porte les deux cas, et c'est voulu : rien en plan, ou plus
           aucune nature ouverte. Des lignes qui ne reprennent rien vaudraient
           moins que cette phrase. */
        <EmptyState
          illustration="rien-approche"
          title={t.reprisesVideTitre}
          text={t.reprisesVideTexte}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + nativeSpace[24] }}
          refreshControl={
            <RefreshControl
              refreshing={rafraichit}
              onRefresh={() => {
                setRafraichit(true);
                void demande().finally(() => setRafraichit(false));
              }}
              tintColor={couleurs.textMention}
            />
          }
        >
          <Text style={[styles.intro, { color: couleurs.textSecondary }]}>{t.reprisesIntro}</Text>
          {liste.map((r) => (
            <CarteDeReprise
              key={r.id}
              reprise={r}
              /* Sans destination — un portrait qui se compose encore —, la carte
                 n'offre pas le geste plutôt que de le rendre muet. */
              {...(destinationDeLaReprise(r) === null ? {} : {
                onReprendre: () => {
                  const ou = destinationDeLaReprise(r)!;
                  routeur.push({ pathname: ou.chemin, params: ou.params } as Href);
                },
              })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function CarteDeReprise({ reprise, onReprendre }: {
  reprise: Reprise;
  onReprendre?: (() => void) | undefined;
}) {
  const { t } = useLangue();
  const couleurs = useCouleurs();
  const passee = reprise.jours !== null && reprise.jours < 0;

  return (
    <Card padding={nativeSpace[14]} radius="lg" style={styles.carte}>
      <View style={styles.tete}>
        <View style={[styles.pastille, { backgroundColor: couleurs.actionQuietBg }]}>
          <Icon name={reprise.icone} size={16} color={couleurs.textAccent} />
        </View>

        {/* PAS DE LIGNE VIDE. La cible est inconnue tant que la production n'a
            pas abouti : la nature prend alors la place du nom plutôt que de
            laisser un blanc sous un sur-titre qui n'annonce rien. */}
        <View style={styles.quoi}>
          {reprise.qui === null ? (
            <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
              {t[reprise.libelle]}
            </Text>
          ) : (
            <>
              <Text style={[styles.nature, { color: couleurs.textSecondary }]} numberOfLines={1}>
                {t[reprise.libelle]}
              </Text>
              <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
                {reprise.qui}
              </Text>
            </>
          )}
        </View>

        {/* Une occasion passée ne se condamne pas : la mention le signale, et le
            travail reste là. Sans date connue, on dit que ça travaille — un
            décompte inventé mentirait sur une cible qu'on ignore. */}
        {reprise.jours === null ? (
          <Text style={[styles.mention, { color: couleurs.textMention }]} numberOfLines={1}>
            {t.genAttenteTitre}
          </Text>
        ) : passee ? (
          <Text style={[styles.mention, { color: couleurs.textMention }]} numberOfLines={1}>
            {t.repriseDepassee}
          </Text>
        ) : (
          <Countdown
            size="s"
            today={reprise.jours === 0}
            label={reprise.jours === 0 ? t.aujourdhui : t.decompteBarre(reprise.jours)}
          />
        )}
      </View>

      {reprise.extrait === null ? null : (
        <View style={styles.citation}>
          <Quote size={14} tone="muted">{reprise.extrait}</Quote>
        </View>
      )}

      {onReprendre === undefined ? null : (
        <Button variant="outline" full style={styles.reprendre} onPress={onReprendre}>
          {t.repriseReprendre}
        </Button>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: nativeSpace[16] },
  panne: { gap: nativeSpace[12] },
  intro: {
    fontFamily: nativeFont.bodyRegular, fontSize: 14,
    marginTop: nativeSpace[4], marginBottom: nativeSpace[16],
  },
  carte: { marginBottom: nativeSpace[10] },
  tete: { flexDirection: "row", alignItems: "flex-start", gap: nativeSpace[12] },
  pastille: {
    width: COTE_DE_LA_PASTILLE, height: COTE_DE_LA_PASTILLE,
    borderRadius: nativeRadius.xs, alignItems: "center", justifyContent: "center",
  },
  quoi: { flex: 1, minWidth: 0 },
  nature: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5 },
  nom: { fontFamily: nativeFont.displayRegular, fontSize: 17, marginTop: 1 },
  mention: { fontFamily: nativeFont.bodyRegular, fontSize: 11.5, marginTop: 3 },
  citation: { marginTop: nativeSpace[10] },
  reprendre: { marginTop: nativeSpace[12], borderWidth: nativeBorder.width },
});
