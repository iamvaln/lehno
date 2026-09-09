import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { creditBalanceSchema, occurrenceSchema, type Occurrence } from "@lehno/contracts";
import {
  nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, CreditIndicator, Icon, LoadingState, PaidActionSheet,
  SensitiveBanner, TextField, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { useActionsPayantes } from "../../lib/MetadonneesProvider.js";
import { ecranEteint } from "../../lib/navigation.js";
import { coutDe } from "../../lib/preparation.js";
import {
  LIMITE_DE_LA_NOTE, demandeDIdees, ideesOffertes, noteTient, noteUtile, ouvertureDuCadrage,
} from "../../lib/cadrage.js";
import { EcranFerme } from "../../composants/EcranFerme.js";

/* « Avant de chercher » — le cadrage des idées de cadeau, §3.7.
 *
 * DEUX RAISONS DE DEMANDER MAINTENANT plutôt qu'après. Un détail que les notes
 * ignorent — « c'est un cadeau commun avec Célarine » — évite une liste hors
 * sujet ; et le demander après aurait coûté un SECOND crédit, puisque refaire
 * est une nouvelle demande.
 *
 * LE CHAMP EST FACULTATIF, et c'est tout le propos : on peut lancer sans rien
 * dire. Le bouton ne s'éteint donc jamais sur une note vide — seulement sur
 * une note trop longue, ou sur un prix que le serveur n'a pas servi.
 *
 * ─── CE QUE LA MAQUETTE DESSINE ET QUI N'EST PAS ICI : LE BUDGET ───────────
 * `CadrageIdeesScreen.jsx` porte un champ de budget et ses trois paliers.
 * `startGenerationSchema` n'a AUCUN champ pour les transporter. Le dessiner
 * quand même ferait s'évaporer la saisie à l'envoi, et les idées reviendraient
 * hors budget sans que personne comprenne pourquoi — sur un résultat déjà
 * payé. Le raisonnement complet est dans `lib/cadrage.ts` ; `cadrageBudget` et
 * `cadrageBudgetAide` restent au dictionnaire, inemployés, comme rappel.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * TOUT CE QUI SE DÉCIDE VIT DANS `lib/cadrage.ts` — la validation du paramètre
 * de route, la borne de la note, la composition du corps, le droit d'ouvrir.
 * `react-native` est typé en Flow et nos outils de test ne savent pas le lire :
 * ici il ne reste que du dessin.
 */
export default function Cadrage() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();
  const prix = useActionsPayantes();
  const { occurrenceId } = useLocalSearchParams<{ occurrenceId?: string }>();

  const eteint = ecranEteint("cadrage", actives);

  /* Le paramètre de route n'est pas de confiance : un lien profond le pose. Il
     est validé contre la forme du CONTRAT avant d'entrer dans un chemin d'API. */
  const ouvre = useMemo(() => ouvertureDuCadrage(occurrenceId), [occurrenceId]);
  const chemin = ouvre.sorte === "cadrer" ? ouvre.chemin : null;

  const [occasion, setOccasion] = useState<Occurrence | null>(null);
  const [solde, setSolde] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [echec, setEchec] = useState<string | null>(null);
  const [confirme, setConfirme] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const charge = useCallback(async () => {
    /* Le drapeau ferme AUSSI le chargement, pas seulement le rendu. Sans cela,
       la route gouvernée rendrait un 404 qui viendrait se poser en bandeau
       rouge par-dessus l'état fermé — sur un compte parfaitement sain. */
    if (eteint) return;
    if (chemin === null) return;
    try {
      /* Le solde vient AVEC l'occasion : la feuille l'annonce à côté du coût,
         et l'aller chercher au moment du geste ferait attendre devant une
         question qu'on vient de poser. */
      const [occ, credits] = await Promise.all([
        appel<unknown>(chemin),
        appel<unknown>("/me/credits"),
      ]);
      setOccasion(occurrenceSchema.parse(occ));
      setSolde(creditBalanceSchema.parse(credits).balance);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [eteint, chemin, langue]);

  useEffect(() => { void charge(); }, [charge]);

  /* Un retour ORDINAIRE. En arrivée directe — notification, lien — il n'y a
     rien derrière : on repose alors l'accueil plutôt que de laisser quelqu'un
     sans issue. */
  const sors = useCallback((): void => {
    if (routeur.canGoBack()) routeur.back();
    else routeur.replace("/(app)/accueil");
  }, [routeur]);

  /* Arriver ici sans occasion visée n'est pas un état à dessiner : c'est une
     navigation qui n'aurait pas dû partir. On ne montre surtout pas un
     formulaire dont le bouton débiterait un crédit pour une cible inconnue. */
  useEffect(() => {
    if (ouvre.sorte === "sans-objet") sors();
  }, [ouvre.sorte, sors]);

  /* LE CRÉDIT EST DÉBITÉ À LA DEMANDE, pas à l'affichage. La clé d'idempotence
     — celle de la préparation, pas une seconde — rend deux appuis maladroits
     reconnaissables comme une seule demande.
     On pousse ensuite vers les reprises, comme la préparation : le jeu d'idées
     n'a pas de résultat au contrat, et l'écran de génération ne sait rendre
     qu'un message. Un renvoi vers un écran qui n'affiche rien serait pire que
     la liste de ce qui travaille. */
  const lance = async (): Promise<void> => {
    const demande = demandeDIdees(occurrenceId, note);
    if (demande === null) return;
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>("/me/generations", {
        method: "POST",
        body: JSON.stringify(demande),
        gouvernee: true,
      });
      routeur.push("/(app)/reprises");
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  if (eteint) return <EcranFerme />;

  const entete = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.retour}
      onPress={sors}
      style={styles.retour}
    >
      <Icon name="chevron-left" size={22} color={couleurs.textBody} />
    </Pressable>
  );

  if (echec !== null && occasion === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[12] }]}>
        {entete}
        <View style={styles.bloc}>
          <Banner intent="error">{echec}</Banner>
          <Button variant="outline" full icon="refresh-cw" onPress={() => void charge()}>
            {t.maintReessayer}
          </Button>
        </View>
      </View>
    );
  }

  if (occasion === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[12] }]}>
        {entete}
        <LoadingState variant="liste" rows={2} title={t.chargement} />
      </View>
    );
  }

  /* UNE OCCASION SENSIBLE N'A PAS D'IDÉES DE CADEAU. On l'atteint pourtant par
     lien profond, et il faut le dire : un formulaire qui accepterait de
     chercher un cadeau pour un deuil est bien pire qu'une phrase. Le message,
     lui, demeure — il se prépare en §3.7, d'où le retour. */
  if (!ideesOffertes(occasion, actives)) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[12] }]}>
        {entete}
        <View style={styles.bloc}>
          <SensitiveBanner>{t.prepSensible}</SensitiveBanner>
          <Button variant="outline" full icon="corner-up-left" onPress={sors}>
            {t.retour}
          </Button>
        </View>
      </View>
    );
  }

  const cout = coutDe(prix, "gift_ideas");
  const deTrop = noteUtile(note).length - LIMITE_DE_LA_NOTE;
  const tient = noteTient(note);

  return (
    <KeyboardAvoidingView
      style={[styles.ecran, { backgroundColor: couleurs.surfacePage }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: nativeSpace[16],
          paddingTop: insets.top + nativeSpace[12],
          paddingBottom: insets.bottom + nativeSpace[24],
        }}
        keyboardShouldPersistTaps="handled"
      >
        {entete}

        {/* Le sujet se dit ici, pas dans un en-tête de pile : porté par le
            châssis, il figeait un nom pour toutes les occasions. */}
        <Text style={[styles.surTitre, { color: couleurs.textSecondary }]}>
          {t.prepPour(occasion.personDisplayName)}
        </Text>
        <Text style={[styles.titre, { color: couleurs.textBody }]} accessibilityRole="header">
          {t.cadrageTitre}
        </Text>

        {echec !== null ? (
          <View style={styles.bandeau}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        <TextField
          multiline
          label={t.cadrageNote}
          placeholder={t.cadrageNotePlaceholder(occasion.personDisplayName)}
          value={note}
          onChangeText={setNote}
          invalid={!tient}
          /* React Native n'a pas d'état « invalide » : la faute doit vivre dans
             le texte d'aide, sans quoi elle ne se voit que pour qui voit le
             contour. Rien ne s'affiche tant que la note tient — un compteur
             permanent sur un champ facultatif presse pour rien. */
          {...(tient ? {} : { hint: t.cadrageNoteLimite(deTrop) })}
        />

        {/* Le pied colle au bas, comme la maquette : le lancement est la
            dernière chose qu'on regarde, pas la première. */}
        <View style={styles.pied}>
          {cout !== null ? (
            <CreditIndicator label={t.creditUnite(cout)} cost={cout} />
          ) : null}
          {solde !== null ? (
            <View style={styles.reste}>
              <CreditIndicator label={t.creditReste(solde)} balance={solde} variant="solde" />
            </View>
          ) : null}
          {/* RIEN NE SE PAIE EN SILENCE : le bouton n'envoie pas, il ouvre la
              feuille qui annonce le coût et le solde. Et il reste éteint quand
              le prix n'est pas servi — une confirmation qui ne saurait quoi
              annoncer vaut moins qu'un bouton qui attend. */}
          <View style={styles.lancer}>
            <Button
              full
              icon="sparkles"
              disabled={envoi || cout === null || !tient}
              onPress={() => setConfirme(true)}
            >
              {t.cadrageLancer}
            </Button>
          </View>
        </View>
      </ScrollView>

      {/* La feuille n'ouvre que si tout ce qu'elle doit annoncer est là : un
          prix servi et un solde lu. En deviner un annoncerait un chiffre que le
          débit démentirait. */}
      {confirme && cout !== null && solde !== null ? (
        <PaidActionSheet
          surTitre={t.prepPour(occasion.personDisplayName)}
          titre={t.prepIdeesTitre}
          resultat={t.prepIdeesTexte}
          coutLibelle={t.creditUnite(cout)}
          soldeLibelle={t.creditReste(solde)}
          lancer={t.feuilleLancer}
          recharger={t.feuilleRecharger}
          pasMaintenant={t.feuillePasMaintenant}
          cout={cout}
          solde={solde}
          insetBas={insets.bottom}
          onConfirmer={() => { setConfirme(false); void lance(); }}
          /* Solde insuffisant, « Recharger » devient l'action PRINCIPALE de la
             feuille : la laisser sans destination ferait le seul geste offert
             un geste muet. §3.9 est portée, elle a une adresse. */
          onRecharger={() => { setConfirme(false); routeur.push("/(app)/recharge"); }}
          onAnnuler={() => setConfirme(false)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  page: { flex: 1, paddingHorizontal: nativeSpace[16] },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  bloc: { gap: nativeSpace[12] },
  surTitre: { fontFamily: nativeFont.bodyRegular, fontSize: 13 },
  titre: {
    fontFamily: nativeFont.displayMedium,
    fontSize: 21,
    marginTop: nativeSpace[2],
    marginBottom: nativeSpace[16],
    letterSpacing: nativeLetterSpacing(21, nativeTracking.display),
  },
  bandeau: { marginBottom: nativeSpace[16] },
  // « marginTop: auto » de la maquette : le pied descend, et l'écran ne se
  // remplit pas de vide entre le champ et le bouton.
  pied: { marginTop: "auto", paddingTop: nativeSpace[24] },
  reste: { marginTop: nativeSpace[6] },
  lancer: { marginTop: nativeSpace[10] },
});
