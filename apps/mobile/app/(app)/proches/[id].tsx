import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  estActive, noteListSchema, personSchema, type Note, type Person,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSpace, nativeTouchMin,
} from "@lehno/tokens";
import {
  Avatar, Banner, Button, Countdown, Icon, LoadingState, Provenance, Quote,
  SectionLabel, Tag, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../../lib/langue.js";
import { appel, ErreurDApi } from "../../../lib/api.js";
import { messageDErreur } from "../../../lib/session.js";
import { useDrapeaux } from "../../../lib/DrapeauxProvider.js";
import { useCategories } from "../../../lib/MetadonneesProvider.js";
import {
  categoriesDeLaNote, dateCourte, estUnGardeFou, interetsEtNotes,
  presseAssezPourSAfficher, sousTitreDuProche,
} from "../../../lib/carnet.js";
import { CLES_DE_CATEGORIE, libelleDeLEcheance } from "../../../lib/libelles.js";

/* La fiche d'un proche.
 *
 * LE NOM SE DIT UNE FOIS. La fiche l'écrit en grand, la barre reste nue —
 * d'où l'absence d'en-tête natif sur cette pile.
 *
 * LES INTÉRÊTS N'ONT PAS DE CHAMP AU CONTRAT : ce sont des notes d'une
 * catégorie. La fiche les montre en étiquettes plutôt qu'en cartes — un mot par
 * carte gaspillerait l'écran — et une note rangée là ne reparaît pas plus bas.
 *
 * LES SORTIES SE DÉCLARENT AVEC LEUR DESTINATION ET LEUR DRAPEAU. Celles dont
 * l'écran n'existe pas encore ne se rendent pas : un bouton qui n'ouvre rien
 * ment davantage qu'un bouton absent. Le jour où l'écran arrive, il suffit de
 * renseigner sa route — la place, l'icône et le libellé sont déjà là.
 */

// Six d'abord, le reste d'un appui : les goûts d'un proche ne se plafonnent
// pas — c'est la matière que l'utilisateur apporte —, c'est la FICHE qui se
// borne.
const INTERETS_VISIBLES = 6;

interface Sortie {
  cle: string;
  icone: "link" | "user-pen" | "sparkles";
  libelle: string;
  // Le drapeau qui la gouverne, ou rien quand elle est du socle.
  drapeau: string | null;
  // La route, ou `null` tant que l'écran n'existe pas dans ce lot.
  route: "/(app)/proches/identite" | null;
}

export default function Proche() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actives } = useDrapeaux();
  const categories = useCategories();

  const [proche, setProche] = useState<Person | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tousLesInterets, setTousLesInterets] = useState(false);
  /* Un chargement qui échoue doit se DIRE. Sans cela, la promesse partait sans
     personne pour la rattraper et l'écran gardait ses squelettes : rien ne
     bougeait, rien n'expliquait, aucun geste à faire. C'est ainsi qu'on a
     découvert que deux appels lancés ensemble se marchaient dessus au
     renouvellement — voir le verrou dans `lib/api.ts`. */
  const [echec, setEchec] = useState<string | null>(null);

  const demande = useCallback(async () => {
    /* Deux appels, en parallèle : la fiche et ses notes durables. Les
       enchaîner ferait attendre deux allers-retours pour un écran qui n'en
       demande qu'un de latence. */
    const [fiche, durables] = await Promise.all([
      appel<unknown>(`/me/persons/${id}`),
      appel<unknown>(`/me/persons/${id}/notes`),
    ]);
    setProche(personSchema.parse(fiche));
    setNotes(noteListSchema.parse(durables));
  }, [id]);

  const charge = useCallback(async () => {
    try {
      await demande();
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [demande, langue]);

  useEffect(() => { void charge(); }, [charge]);

  if (!proche) {
    return (
      <View style={[styles.attente, {
        backgroundColor: couleurs.surfacePage, paddingTop: insets.top + nativeSpace[24],
      }]}>
        {echec ? (
          <View style={{ gap: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
            <Button variant="outline" full icon="refresh-cw" onPress={() => void charge()}>
              {t.maintReessayer}
            </Button>
          </View>
        ) : (
          <LoadingState variant="liste" rows={3} title={t.chargement} />
        )}
      </View>
    );
  }

  const { interets, cartes } = interetsEtNotes(notes, categories);
  const vus = tousLesInterets ? interets : interets.slice(0, INTERETS_VISIBLES);
  const reste = interets.length - vus.length;
  const jours = proche.nextOccurrence?.daysUntil ?? null;

  /* Le sous-titre se COMPOSE : la nature de la prochaine échéance, et sa date.
     Deux parties, comme le kit les compose — j'y mettais aussi le registre, qui
     n'y est pas. Sans échéance, il n'y a pas de sous-titre du tout, et c'est
     cohérent : pas de titre de section sans contenu. */
  const sousTitre = sousTitreDuProche([
    proche.nextOccurrence
      ? libelleDeLEcheance(proche.nextOccurrence.kind, proche.nextOccurrence.label, t)
      : null,
    proche.nextOccurrence ? dateCourte(proche.nextOccurrence.occurrenceDate, langue) : null,
  ]);

  const TOUTES: Sortie[] = [
    { cle: "collecte", icone: "link", libelle: t.ficheCollecteCourt, drapeau: "collect", route: null },
    { cle: "identite", icone: "user-pen", libelle: t.ficheIdentiteCourt, drapeau: null, route: "/(app)/proches/identite" },
    { cle: "portrait", icone: "sparkles", libelle: t.fichePortraitsCourt, drapeau: "generation.portrait", route: null },
  ];
  const sorties = TOUTES.filter(
    (s) => s.route !== null && (s.drapeau === null || estActive(actives, s.drapeau)),
  );

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={{
        paddingTop: insets.top + nativeSpace[12],
        paddingBottom: insets.bottom + nativeSpace[20],
        paddingHorizontal: nativeSpace[16],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.retour}
        onPress={() => routeur.back()}
        style={[styles.retour]}
      >
        <Icon name="chevron-left" size={22} color={couleurs.textBody} />
      </Pressable>

      <View style={[styles.entete]}>
        <Avatar
          name={proche.displayName}
          size={54}
          {...(proche.avatarUrl ? { source: proche.avatarUrl } : {})}
        />
        <View style={[styles.identite]}>
          <Text style={[styles.nom, { color: couleurs.textBody }]}>{proche.displayName}</Text>
          {sousTitre ? (
            <Text style={[styles.sousTitre, { color: couleurs.textSecondary }]} numberOfLines={1}>
              {sousTitre}
            </Text>
          ) : null}
        </View>
        {presseAssezPourSAfficher(jours) ? (
          <Countdown
            size="s"
            today={jours === 0}
            label={jours === 0 ? t.aujourdhui : t.decompteBarre(jours ?? 0)}
          />
        ) : null}
      </View>

      {interets.length ? (
        <View style={[styles.bloc]}>
          <SectionLabel>{t.ficheInterets}</SectionLabel>
          <View style={[styles.etiquettes]}>
            {vus.map((n) => <Tag key={n.id}>{n.content}</Tag>)}
            {reste ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setTousLesInterets(true)}
                style={[styles.reste, { borderColor: couleurs.borderObject }]}
              >
                <Text style={[styles.resteTexte, { color: couleurs.textAccent }]}>
                  {t.ficheGoutsReste(reste)}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {cartes.length ? (
        <View style={[styles.bloc]}>
          <SectionLabel>{t.ficheNotes}</SectionLabel>
          <View style={[styles.cartes]}>
            {cartes.map((n) => {
              const eviter = estUnGardeFou(n, categories);
              const siennes = categoriesDeLaNote(n);
              return (
                /* « À éviter » se dessine autrement — en pointillé, sans fond :
                   c'est un garde-fou, pas une suggestion. */
                <View
                  key={n.id}
                  style={[styles.carte, {
                    borderColor: couleurs.borderObject,
                    borderStyle: eviter ? "dashed" : "solid",
                    backgroundColor: eviter ? "transparent" : couleurs.surfaceCard,
                  }]}
                >
                  {/* La note dit SES catégories, toutes. Elle en porte parfois
                      deux — ce qu'un proche traverse relève des challenges et
                      de ce qu'il a besoin d'entendre —, et n'en montrer qu'une
                      choisirait à sa place. Aucune n'est aussi un état valide :
                      une note que le système n'a pas su ranger reste telle
                      quelle, sans repli sur une catégorie fourre-tout. */}
                  {siennes.length ? (
                    <View style={[styles.nature]}>
                      <Icon
                        name={eviter ? "ban" : "lightbulb"}
                        size={13}
                        strokeWidth={2}
                        color={eviter ? couleurs.textSecondary : couleurs.textAccent}
                      />
                      <Text style={[styles.natureTexte, {
                        color: eviter ? couleurs.textSecondary : couleurs.textAccent,
                      }]}>
                        {siennes.map((code) => t[CLES_DE_CATEGORIE[code]]).join(" · ")}
                      </Text>
                    </View>
                  ) : null}
                  <Quote size={15}>{n.content}</Quote>
                  {/* La provenance ne s'invente pas : tant que le contrat ne
                      dit pas qui a écrit la note ni quand, on n'affiche que la
                      date de saisie. */}
                  <Provenance origin={null} date={dateCourte(n.createdAt.slice(0, 10), langue)} />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {sorties.length ? (
        <View style={[styles.sorties]}>
          {sorties.map((s) => (
            <Button
              key={s.cle}
              variant="outline"
              full
              icon={s.icone}
              onPress={() => routeur.push({ pathname: s.route!, params: { id: proche.id } })}
            >
              {s.libelle}
            </Button>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  attente: { flex: 1, paddingHorizontal: nativeSpace[16] },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  entete: { flexDirection: "row", alignItems: "center", gap: nativeSpace[14], marginBottom: nativeSpace[16] },
  identite: { flex: 1, minWidth: 0 },
  nom: { fontFamily: nativeFont.displayRegular, fontSize: 22 },
  sousTitre: { fontFamily: nativeFont.bodyRegular, fontSize: 13, marginTop: 1 },
  bloc: { marginTop: nativeSpace[20] },
  etiquettes: { flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[6], marginTop: nativeSpace[8] },
  reste: {
    minHeight: 30, paddingHorizontal: nativeSpace[12], justifyContent: "center",
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width, borderStyle: "dashed",
  },
  resteTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
  cartes: { gap: nativeSpace[12], marginTop: nativeSpace[12] },
  carte: { padding: nativeSpace[14], borderRadius: nativeRadius.lg, borderWidth: nativeBorder.width },
  nature: { flexDirection: "row", alignItems: "center", gap: nativeSpace[4] },
  natureTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 12, textTransform: "uppercase" },
  sorties: { gap: nativeSpace[8], marginTop: nativeSpace[24] },
});
