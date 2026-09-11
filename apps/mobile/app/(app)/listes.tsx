import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  occurrenceSchema, personListSchema, wishlistListSchema,
  type Occurrence, type Wishlist,
} from "@lehno/contracts";

/* `/me/occurrences` rend un tableau nu — comme l'écran de note le lit déjà.
   On compose donc la liste ici plutôt que d'ajouter un nom au contrat pour un
   seul appelant de plus. */
const listeDEcheances = occurrenceSchema.array();
import {
  nativeBorder, nativeFont, nativeRadius, nativeSpace, nativeTouchMin,
} from "@lehno/tokens";
import {
  Banner, Button, Card, EmptyState, Icon, LoadingState, ScreenHeader, SectionLabel, Tag,
  TextField, Toast, useCouleurs
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { libelleDeLEcheance } from "../../lib/libelles.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { ecranEteint } from "../../lib/navigation.js";
import { EcranFerme } from "../../composants/EcranFerme.js";
import {
  listesRangees, occasionsOuvrables, peutChercherDesIdees, peutPartager,
  nomDeLaListe, ouvertureDeListe, quandDeLaListe, resteAOffrir, type OuvertureDeListe,
} from "../../lib/listes.js";

/* Mes wishlists — §3.29.
 *
 * UNE LISTE EST SON OCCASION. Le contrat ne lui donne pas de nom : elle porte
 * son occurrence, sa date et la nature de l'événement — « un cadeau de Noël
 * n'est pas un cadeau de mariage ».
 *
 * CE QUE LA MAQUETTE DEMANDE ET QUE LE CONTRAT NE PORTE PAS : un champ « nom
 * de la liste », une option « sans occasion », et une clôture réglable.
 * `createWishlistSchema` est `.strict()` et ne prend qu'une `occurrenceId`,
 * obligatoire. Ces trois champs feraient un formulaire dont la saisie
 * s'évapore — ou une requête refusée en bloc pour un champ en trop. Le manque
 * est relevé dans `specs/remontees-mobile-2026-08-29.md` (§3 bis).
 *
 * OUVRIR UNE LISTE, C'EST CHOISIR UNE DE SES PROPRES DATES. « Ouvrir une liste
 * sur l'occasion d'un proche publierait ce que ce proche n'a jamais accepté de
 * publier » — d'où le filtre sur ses propres occurrences, et non sur toutes.
 *
 * ON NE DIFFUSE PAS UNE PAGE QU'ON N'A PAS VUE. « Partager » ouvrait ici la
 * feuille du système sans jamais montrer la page ; le geste passe désormais
 * par l'aperçu — c'est le seul endroit où l'on découvre qu'une liste pleine de
 * souhaits privés s'ouvre sur rien.
 */
export default function Listes() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();
  /* UNE ROUTE RESTE UNE ROUTE. La navigation ne propose plus cet écran
     quand son drapeau est éteint, mais un lien profond l'atteint encore :
     il se garde donc lui-même plutôt que de compter sur celui qui l'ouvre. */
  const eteint = ecranEteint("listes", actives);

  const [listes, setListes] = useState<Wishlist[] | null>(null);
  const [miennes, setMiennes] = useState<Occurrence[]>([]);
  const [creation, setCreation] = useState(false);
  /* `null` n'est plus « rien de choisi » mais « SANS OCCASION » — un choix, pas
     une absence. C'est `choisi` qui dit si l'on a tranché : sans lui, on ne
     saurait pas distinguer le formulaire qu'on vient d'ouvrir de celui où l'on
     a délibérément coché « sans occasion ». */
  const [ouvre, setOuvre] = useState<string | null>(null);
  const [choisi, setChoisi] = useState(false);
  const [nom, setNom] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const mes = wishlistListSchema.parse(await appel<unknown>("/me/wishlists"));
      setListes(mes);
      /* Mes propres échéances, pour savoir sur quoi une liste peut s'ouvrir.
         La fiche de soi est marquée `isSelf` au contrat ; on demande donc les
         occurrences de cette fiche, jamais toutes — le carnet entier ferait
         proposer d'ouvrir une liste sur l'anniversaire d'un proche. */
      const carnet = personListSchema.parse(await appel<unknown>("/me/persons?limit=100"));
      const soi = carnet.persons.find((p) => p.isSelf);
      if (soi) {
        setMiennes(listeDEcheances.parse(
          await appel<unknown>(`/me/occurrences?personId=${soi.id}&limit=100`),
        ));
      }
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useFocusEffect(useCallback(() => { if (!eteint) void charge(); }, [charge, eteint]));

  const ouvreUneListe = async (corps: OuvertureDeListe): Promise<void> => {
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>("/me/wishlists", {
        method: "POST",
        body: JSON.stringify(corps),
      });
      setOuvre(null);
      setChoisi(false);
      setNom("");
      setCreation(false);
      setAccuse(t.listeNouvFait);
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  /* La garde de RENDU passe AVANT celle du chargement : sans elle, l'écran
     éteint ne charge rien — c'est le but — et restait donc bloqué sur son
     voile de chargement, qui ne se levait jamais. */
  if (eteint) return <EcranFerme />;

  /* LA FLÈCHE VIT DANS TOUS LES ÉTATS, pas seulement dans le nominal :
     l'écran de panne et celui de chargement la perdaient, et avec elle le
     seul moyen visible de revenir. `retours.test.ts` le vérifie. */
  const retour = (
    <ScreenHeader titre={t.enteteListes} retour={t.retour} onRetour={() => routeur.back()} />
  );

  if (echec && listes === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        {retour}
        <Banner intent="error">{echec}</Banner>
        <View style={{ marginTop: nativeSpace[12] }}>
          <Button variant="outline" full icon="refresh-cw" onPress={() => void charge()}>
            {t.maintReessayer}
          </Button>
        </View>
      </View>
    );
  }

  if (listes === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        {retour}
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const ouvrables = occasionsOuvrables(miennes, listes);

  /* CRÉER UNE LISTE — un pas à part, comme la maquette le dessine.
   *
   * Le formulaire vivait au pied de la liste, sous un titre de section : on
   * ouvrait une wishlist en frôlant une pastille sans jamais l'avoir décidé.
   * Un pas qui remplace l'écran demande un geste pour entrer et un pour sortir.
   *
   * Une occasion s'y annonce par CE QU'ELLE EST et par SA DATE — « anniversaire
   * · 3 sept. ». La date seule ne dit pas de quoi il s'agit, et deux dates
   * voisines devenaient indiscernables.
   */
  /* Ce qui partirait au serveur, calculé une fois : le bouton s'en sert pour
     savoir s'il s'allume, et l'envoi pour savoir quoi poster. Deux lectures
     séparées finiraient par diverger — le bouton allumé sur une demande que
     l'envoi refuserait de composer. */
  const demande = ouvertureDeListe(ouvre, nom);

  if (creation) {
    return (
      /* LE CLAVIER CACHAIT LE PIED, et le pied porte les deux seuls gestes de
         l'écran. Le champ du nom l'appelle dès qu'on le touche ; « Enregistrer »
         et « Pas maintenant » passaient dessous, hors d'atteinte.

         `keyboardShouldPersistTaps` va avec, et ce n'est pas un détail
         cosmétique : sans lui, le premier appui hors du champ est MANGÉ par le
         renvoi du clavier. On tapait sur « Sans occasion », rien ne se cochait,
         et il fallait taper deux fois sans comprendre pourquoi. */
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: couleurs.surfacePage }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.page, {
            paddingTop: insets.top + nativeSpace[20],
            paddingBottom: nativeSpace[16],
          }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.grandTitre, { color: couleurs.textBody }]}>
            {t.listeCreer}
          </Text>

          {/* LE NOM EN PREMIER, comme la planche : c'est le seul champ qu'on
              saisit, et sans occasion c'est le seul qui distingue une liste de
              la suivante. */}
          <View style={{ marginTop: nativeSpace[16] }}>
            <TextField
              label={t.listeNouvNom}
              placeholder={t.listeNouvNomExemple}
              value={nom}
              onChangeText={setNom}
            />
          </View>

          <View style={{ marginTop: nativeSpace[20] }}>
            <SectionLabel>{t.listeNouvOccasion}</SectionLabel>
          </View>

          {/* « SANS OCCASION » EST UN CHOIX, en tête et toujours offert.
              C'est lui qui débloque le cas où l'on n'a aucune date à soi — un
              compte neuf n'en a pas : les premières dates qu'on saisit sont
              celles de ses proches. Sans cette ligne, l'écran s'ouvrait sur
              « aucune date », le bouton éteint, et rien à faire. */}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: choisi && ouvre === null, checked: choisi && ouvre === null }}
            onPress={() => { setOuvre(null); setChoisi(true); }}
            style={[styles.occasion, { marginTop: nativeSpace[8] }]}
          >
            <View style={[styles.pastille, {
              borderColor: choisi && ouvre === null ? couleurs.action : couleurs.borderObject,
            }]}>
              {choisi && ouvre === null ? (
                <View style={[styles.noyau, { backgroundColor: couleurs.action }]} />
              ) : null}
            </View>
            <View style={styles.pleine}>
              <Text style={[styles.occasionNom, { color: couleurs.textBody }]}>
                {t.listeNouvSansOccasion}
              </Text>
              <Text style={[styles.mention, { color: couleurs.textMention }]}>
                {t.listeNouvSansOccasionAide}
              </Text>
            </View>
          </Pressable>

          {ouvrables.length ? (
            <View style={{ marginTop: nativeSpace[8] }}>
              {ouvrables.map((o) => {
                const actif = choisi && ouvre === o.id;
                return (
                  <Pressable
                    key={o.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: actif, checked: actif }}
                    onPress={() => { setOuvre(o.id); setChoisi(true); }}
                    style={[styles.occasion, {
                      borderTopWidth: nativeBorder.width,
                      borderTopColor: couleurs.borderHairline,
                    }]}
                  >
                    <View style={[styles.pastille, {
                      borderColor: actif ? couleurs.action : couleurs.borderObject,
                    }]}>
                      {actif ? (
                        <View style={[styles.noyau, { backgroundColor: couleurs.action }]} />
                      ) : null}
                    </View>
                    <View style={styles.pleine}>
                      <Text style={[styles.occasionNom, { color: couleurs.textBody }]}>
                        {libelleDeLEcheance(
                          o.kind === "birthday" ? "birthday" : "other", o.label, t,
                        )}
                      </Text>
                      <Text style={[styles.mention, { color: couleurs.textMention }]}>
                        {quandDeLaListe(o.occurrenceDate, langue) ?? t.listeSansDate}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            /* AUCUNE DATE À SOI N'EST PAS « RIEN À CHOISIR » : sans date, il
               n'y a rien à ouvrir nulle part, et le dire sans geste laisse
               deviner où aller. Le bouton renvoie vers l'écran qui pose une
               date — le seul — et le retour ramène ici. */
            <View style={{ marginTop: nativeSpace[8] }}>
              <Text style={[styles.mention, { color: couleurs.textMention }]}>
                {t.listeVotreDateAbsente}
              </Text>
              {/* ON NE REMET PAS UN FORMULAIRE ICI. Un second endroit où poser
                  sa date divergerait du premier au premier réglage ; on renvoie
                  vers celui qui existe, et le retour ramène ici. */}
              <View style={{ marginTop: nativeSpace[12] }}>
                <Button
                  variant="outline"
                  full
                  icon="plus"
                  onPress={() => routeur.push("/evenement")}
                >
                  {t.ficheAjouterDate}
                </Button>
              </View>
            </View>
          )}

          {echec ? (
            <View style={{ marginTop: nativeSpace[12] }}>
              <Banner intent="error">{echec}</Banner>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.pied, {
            paddingBottom: insets.bottom + nativeSpace[12],
            borderTopColor: couleurs.borderHairline,
          }]}>
          {/* Le bouton s'éteint tant que la demande ne tient pas — sans
              occasion, il faut un nom, et c'est le serveur qui le dit :
              « une liste sans occasion a besoin d'un nom ». L'éteindre vaut
              mieux que de faire découvrir la règle par un refus. */}
          <Button
            full
            disabled={envoi || !choisi || demande === null}
            onPress={() => { if (demande) void ouvreUneListe(demande); }}
          >
            {t.enregistrer}
          </Button>
          <Button
            full
            variant="text"
            onPress={() => { setCreation(false); setOuvre(null); setChoisi(false); setNom(""); }}
          >
            {t.feuillePasMaintenant}
          </Button>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }}>
      <ScrollView
        contentContainerStyle={[styles.page, {
          paddingTop: insets.top + nativeSpace[8],
          paddingBottom: insets.bottom + nativeSpace[24],
        }]}
      >
        {retour}

        {echec ? (
          <View style={{ marginBottom: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        {listes.length ? (
          <>
            {/* Le « + » de la maquette, en tête : la création s'atteint depuis
                la liste elle-même, et non depuis un formulaire posé au pied de
                l'écran qu'il fallait faire défiler pour découvrir. */}
            <Pressable
              accessibilityRole="button"
              onPress={() => setCreation(true)}
              style={[styles.ajout, { borderColor: couleurs.borderObject }]}
            >
              <Icon name="plus" size={15} strokeWidth={2} color={couleurs.textAccent} />
              <Text style={[styles.ajoutTexte, { color: couleurs.textAccent }]}>
                {t.listeCreer}
              </Text>
            </Pressable>

            {listesRangees(listes).map((l) => (
              <Card key={l.id} surface="panel" padding={15} radius="lg" style={styles.carte}>
                <Pressable
                  accessibilityRole="button"
                  /* Le nom voyage avec : l'écran d'arrivée le met en en-tête,
                     et aller le rechercher ferait un appel pour un titre. */
                  onPress={() => routeur.push({
                    pathname: "/(app)/souhaits", params: { id: l.id, nom: nomDeLaListe(l, t) },
                  })}
                  style={styles.entete}
                >
                  <View style={styles.pleine}>
                    <Text style={[styles.titre, { color: couleurs.textBody }]} numberOfLines={1}>
                      {nomDeLaListe(l, t)}
                    </Text>
                    {/* « Sans date » plutôt qu'une date fausse : le contrat
                        vérifie la forme de `occurrenceDate`, pas le calendrier. */}
                    <Text style={[styles.mention, { color: couleurs.textMention }]}>
                      {quandDeLaListe(l.occurrenceDate, langue) ?? t.listeSansDate}
                    </Text>
                  </View>
                  {l.isArchived ? <Tag tone="quiet">{t.listeArchivee}</Tag> : null}
                  <Icon name="chevron-right" size={15} color={couleurs.textMention} />
                </Pressable>

                {/* COMBIEN, jamais LESQUELS ni PAR QUI : savoir qui a réservé quoi
                    gâcherait la surprise qu'on prépare. */}
                <Text style={[styles.compte, { color: couleurs.textSecondary }]}>
                  {t.listeRetenu} · {l.reservedCount} / {l.wishCount}
                  {resteAOffrir(l) > 0 ? "" : ` · ${t.souhaitReserve}`}
                </Text>

                {l.isArchived ? (
                  <Text style={[styles.mention, { color: couleurs.textMention }]}>
                    {t.listeArchiveeTexte}
                  </Text>
                ) : null}

                {/* VOIR AVANT D'ENVOYER. Le bouton ne partage plus : il ouvre la
                    page telle qu'un visiteur la reçoit, et c'est de là que part
                    le lien. Une liste archivée ou vide n'y mène pas — l'une
                    n'accepte plus rien, l'autre ferait choisir dans rien. */}
                {peutPartager(l) ? (
                  <View style={{ marginTop: nativeSpace[10] }}>
                    <Button
                      full
                      icon="eye"
                      onPress={() => routeur.push({
                        pathname: "/(app)/apercu-liste", params: { id: l.id },
                      })}
                    >
                      {t.listeApercu}
                    </Button>
                  </View>
                ) : null}

                {/* CHERCHER DES IDÉES. Aucun coût annoncé ici, et c'est
                    délibéré : le kit écrit « 1 crédit » en dur, alors que le
                    tarif se règle en administration. L'écran de préparation le
                    lit et l'annonce avant de débiter — « rien ne se paie en
                    silence » ne vaut que si le montant montré est le montant
                    prélevé. */}
                {peutChercherDesIdees(l, actives) ? (
                  <View style={{ marginTop: nativeSpace[8] }}>
                    <Button
                      full
                      variant="outline"
                      icon="sparkles"
                      onPress={() => routeur.push({
                        pathname: "/(app)/preparation",
                        params: { occurrenceId: l.occurrenceId },
                      })}
                    >
                      {t.listeChercher}
                    </Button>
                  </View>
                ) : null}
              </Card>
            ))}
          </>
        ) : (
          /* L'ÉTAT VIDE PORTE SON GESTE. Il annonçait l'absence et s'arrêtait
             là ; le seul chemin vers la création était un formulaire plus bas,
             qui disparaissait justement quand aucune date n'était ouvrable —
             l'écran ne proposait alors plus rien du tout. */
          <View style={styles.vide}>
            <EmptyState
              illustration="souhaits-vide"
              title={t.videListesTitre}
              text={t.videListesTexte}
              actionLabel={t.listeCreer}
              onAction={() => setCreation(true)}
            />
          </View>
        )}
      </ScrollView>

      {accuse ? (
        <Toast intent="success" insetBas={insets.bottom} onDismiss={() => setAccuse(null)}>
          {accuse}
        </Toast>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  grandTitre: { fontFamily: nativeFont.displayMedium, fontSize: 21 },
  carte: { marginTop: nativeSpace[12] },
  entete: { flexDirection: "row", alignItems: "center", gap: nativeSpace[10] },
  pleine: { flex: 1, minWidth: 0 },
  titre: { fontFamily: nativeFont.displayMedium, fontSize: 17 },
  mention: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[4] },
  compte: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[8] },
  vide: { flexGrow: 1, justifyContent: "center" },
  ajout: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: nativeSpace[8], minHeight: nativeTouchMin, borderRadius: nativeRadius.pill,
    borderWidth: nativeBorder.width, borderStyle: "dashed", marginTop: nativeSpace[8],
  },
  ajoutTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
  occasion: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[10],
    paddingVertical: nativeSpace[10], minHeight: nativeTouchMin,
  },
  /* `pill` plutôt qu'une moitié de largeur calculée : le rayon se prend au
     jeton, et un 999 se rabat de lui-même sur le cercle à cette taille. */
  pastille: {
    width: 20, height: 20, borderRadius: nativeRadius.pill,
    borderWidth: nativeBorder.width, alignItems: "center", justifyContent: "center",
  },
  noyau: { width: 10, height: 10, borderRadius: nativeRadius.pill },
  occasionNom: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  pied: {
    paddingHorizontal: nativeSpace[16], gap: nativeSpace[8],
    borderTopWidth: nativeBorder.width, paddingTop: nativeSpace[12],
  },
});
