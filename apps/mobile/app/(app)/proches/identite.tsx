import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CONTACT_CHANNELS, PERSON_GENDERS, PERSON_REGISTERS, PERSON_RELATIONS,
  personSchema, type ContactChannel, type PersonGender, type PersonRegister,
  type PersonRelation,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSpace,
} from "@lehno/tokens";
import {
  Avatar, Button, Icon, SectionLabel, TextField, useCouleurs,
} from "@lehno/ui-native";
import { Choix } from "../../../composants/Choix.js";
import { useLangue } from "../../../lib/langue.js";
import { appel, ErreurDApi } from "../../../lib/api.js";
import { messageDErreur } from "../../../lib/session.js";
import {
  CLES_DE_CANAL, CLES_DE_GENRE, CLES_DE_REGISTRE, CLES_DE_RELATION,
} from "../../../lib/libelles.js";
import { naissanceAEnvoyer, naissanceLue } from "../../../lib/carnet.js";
import { nomsDesMois } from "../../../lib/evenement.js";
import { Bascule } from "../../../composants/Bascule.js";

/* L'identité d'un proche — et sa création.
 *
 * C'EST LE GESTE QUI DÉCIDE, pas l'absence de nom. Ouvert depuis le carnet
 * sans identifiant, l'écran crée : rien n'est prérempli — ni registre, ni lien,
 * ni canal choisis à la place de quelqu'un — et il n'y a rien à supprimer.
 * Ouvert depuis une fiche, il corrige.
 *
 * LE NOM D'USAGE EST UN CHAMP À PART. « Maman », « mon vieux » : c'est ce
 * nom-là qui paraît dans les messages, pas celui des listes. Les confondre
 * faisait écrire « Bonjour Marie-Ange Nkoulou » à qui dit « Maman ».
 *
 * LE LIEN COEXISTE AVEC LE SOUVENIR, et ce n'est pas une redondance :
 * l'énumération sert la génération, le texte libre garde la nuance qu'elle
 * écrase — « on a fait la fac ensemble » ne rentre dans aucune case.
 *
 * LE GENRE N'A PAS DE CHAMP, et il n'en a plus au contrat non plus : retiré de
 * la lecture comme de l'écriture. Tant qu'il traversait, la règle ne tenait que
 * par la retenue du client.
 *
 * L'identité est du SOCLE : aucun drapeau ne la gouverne.
 */
export default function Identite() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const creation = !id;

  const [nom, setNom] = useState("");
  const [appelle, setAppelle] = useState("");
  const [relation, setRelation] = useState<PersonRelation | null>(null);
  /* LA NAISSANCE — le champ qui manquait. Sans lui, on créait un proche, on se
     voyait refuser son anniversaire faute de naissance, et l'écran renvoyait
     vers CETTE fiche, qui ne l'offrait pas. La promesse du produit — être là le
     jour J — était inatteignable. */
  const [jourNe, setJourNe] = useState<number | null>(null);
  const [moisNe, setMoisNe] = useState<number | null>(null);
  const [anneeNee, setAnneeNee] = useState("");
  const [anneeConnue, setAnneeConnue] = useState(true);
  const [genre, setGenre] = useState<PersonGender | null>(null);
  const [souvenir, setSouvenir] = useState("");
  const [registre, setRegistre] = useState<PersonRegister | null>(null);
  const [canal, setCanal] = useState<ContactChannel | null>(null);
  const [ville, setVille] = useState("");
  const [pret, setPret] = useState(creation);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charge = useCallback(async () => {
    if (!id) return;
    const fiche = personSchema.parse(await appel<unknown>(`/me/persons/${id}`));
    setNom(fiche.displayName);
    setAppelle(fiche.callingName ?? "");
    setRelation(fiche.relation);
    setGenre(fiche.gender);
    setSouvenir(fiche.relationHint ?? "");
    setRegistre(fiche.register);
    setCanal(fiche.preferredChannel);
    setVille(fiche.city ?? "");
    /* On ne montre PAS l'année de support quand elle est inconnue : l'afficher
       la ferait passer pour un fait, alors qu'elle est notre invention. */
    const nee = naissanceLue(fiche.birthDate, fiche.birthYearKnown);
    setJourNe(nee.jour);
    setMoisNe(nee.mois);
    setAnneeNee(nee.annee ? String(nee.annee) : "");
    setAnneeConnue(nee.anneeConnue);
    setPret(true);
  }, [id]);

  useEffect(() => { void charge(); }, [charge]);

  const enregistre = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      /* On n'envoie que ce qui est renseigné. Poster une chaîne vide
         écrirait « » là où le serveur avait `null`, et la génération lirait
         une ville qui n'existe pas. */
      const corps = {
        displayName: nom.trim(),
        ...(appelle.trim() ? { callingName: appelle.trim() } : {}),
        ...(relation ? { relation } : {}),
        /* OBLIGATOIRE à la création. Le contrat en fait un champ requis pour
           une seule raison : « en français on n'écrit pas à quelqu'un sans le
           savoir ». Le rendre facultatif produirait des messages en tournures
           contournées pour tous ceux qui auraient sauté le champ — c'est-à-dire
           la plupart —, et personne n'aurait su pourquoi les textes sonnaient
           bizarrement. */
        ...(genre ? { gender: genre } : {}),
        ...(souvenir.trim() ? { relationHint: souvenir.trim() } : {}),
        ...(registre ? { register: registre } : {}),
        ...(canal ? { preferredChannel: canal } : {}),
        ...(ville.trim() ? { city: ville.trim() } : {}),
        /* Rien tant que la date est incomplète : un jour sans mois ferait une
           date bancale que le serveur refuserait sans dire laquelle des deux
           moitiés manquait. */
        ...(naissanceAEnvoyer({
          jour: jourNe, mois: moisNe,
          annee: anneeNee.trim() ? Number(anneeNee.trim()) : null,
          anneeConnue,
        }) ?? {}),
      };
      if (creation) {
        await appel<unknown>("/me/persons", { method: "POST", body: JSON.stringify(corps) });
        /* ON REMPLACE, ON NE REVIENT PAS. Cet écran vit dans la pile de
           l'onglet des proches, et `back()` ramène à l'écran PRÉCÉDENT — qui
           peut appartenir à un autre onglet, l'accueil quand on crée son
           premier proche depuis l'état vide. Le formulaire restait alors sur la
           pile : revenir à « Proches » rouvrait la saisie qu'on venait
           d'enregistrer, encore remplie, au lieu du carnet.

           Remplacer le pose sur le carnet — où le proche qu'on vient de créer
           se voit, ce qui est aussi la meilleure réponse à ce qu'on a fait. */
        routeur.replace("/(app)/proches");
        return;
      }
      await appel<unknown>(`/me/persons/${id}`, { method: "PATCH", body: JSON.stringify(corps) });
      // Une correction revient d'où elle vient : la fiche qu'on était en train
      // de lire, et qu'on veut retrouver telle qu'on l'a laissée.
      routeur.back();
    } catch (e) {
      setErreur(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  const supprime = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      await appel<unknown>(`/me/persons/${id}`, { method: "DELETE" });
      // Deux crans en arrière : la fiche qu'on vient de supprimer est encore
      // dans la pile, et y revenir montrerait un proche qui n'est plus.
      routeur.dismissAll();
      routeur.replace("/(app)/proches");
    } catch (e) {
      setErreur(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
      setEnvoi(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: couleurs.surfacePage }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + nativeSpace[12],
          paddingBottom: insets.bottom + nativeSpace[20],
          paddingHorizontal: nativeSpace[16],
        }}
        keyboardShouldPersistTaps="handled"
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
          <Avatar name={creation ? "?" : nom} size={52} />
          <View style={[styles.titres]}>
            <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.identiteTitre}</Text>
            {/* L'intro dit POURQUOI ces champs existent. Sans elle, ils
                passeraient pour un classement administratif. */}
            <Text style={[styles.intro, { color: couleurs.textSecondary }]}>{t.identiteIntro}</Text>
          </View>
        </View>

        <View style={[styles.champs]}>
          <TextField label={t.champNom} value={nom} onChangeText={setNom} />
          <TextField
            label={t.champAppelle}
            value={appelle}
            onChangeText={setAppelle}
            hint={t.champAppelleAide}
          />
        </View>

        <View style={[styles.bloc]}>
          <SectionLabel>{t.champRelation}</SectionLabel>
          <Choix
            options={PERSON_RELATIONS}
            libelle={(v) => t[CLES_DE_RELATION[v]]}
            valeur={relation}
            pose={setRelation}
          />
        </View>

        <View style={[styles.bloc]}>
          <TextField
            label={t.champRelationHint}
            value={souvenir}
            onChangeText={setSouvenir}
            hint={t.champRelationHintAide}
          />
        </View>

        <View style={[styles.bloc]}>
          <SectionLabel>{t.identNaissance}</SectionLabel>
          {/* JOUR PUIS MOIS, comme l'écran d'événement les pose : une rangée
              qui défile pour les trente et un, une grille pour les douze. Un
              sélecteur natif demanderait une année — et c'est justement elle
              qu'on ignore le plus souvent. */}
          <Text style={[styles.sousTitre, { color: couleurs.textSecondary }]}>{t.evtJour}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.rangee}
          >
            {JOURS.map((j) => (
              <Pastille
                key={j}
                actif={jourNe === j}
                libelle={String(j)}
                appuie={() => setJourNe(j)}
              />
            ))}
          </ScrollView>

          <Text style={[styles.sousTitre, { color: couleurs.textSecondary }]}>{t.evtMois}</Text>
          <View style={styles.pastilles}>
            {nomsDesMois(langue).map((nom, i) => (
              <Pastille
                key={nom}
                actif={moisNe === i + 1}
                libelle={nom}
                appuie={() => setMoisNe(i + 1)}
              />
            ))}
          </View>

          {/* L'ANNÉE EST À PART, et elle se déclare inconnue. On sait le jour et
              le mois d'un anniversaire bien plus souvent que l'âge — et le
              contrat porte `birthYearKnown` exactement pour ça : « on suit
              alors l'anniversaire sans pouvoir annoncer d'âge ». */}
          <View style={styles.bascule}>
            <Bascule
              actif={!anneeConnue}
              libelle={t.identAnneeInconnue}
              onBascule={() => setAnneeConnue((v) => !v)}
            />
          </View>
          {anneeConnue ? (
            <TextField
              label={t.identAnnee}
              nature="annee"
              value={anneeNee}
              onChangeText={setAnneeNee}
            />
          ) : null}
          <Text style={[styles.aide, { color: couleurs.textMention }]}>{t.identNaissanceAide}</Text>
        </View>

        <View style={[styles.bloc]}>
          {/* DEUX valeurs, parce que c'est un accord et non une identité :
              un accord français n'a que deux formes. Aucune phrase de
              l'interface ne s'en sert — seule la génération le reçoit. */}
          <SectionLabel>{t.champGenre}</SectionLabel>
          <Choix
            options={PERSON_GENDERS}
            libelle={(v) => t[CLES_DE_GENRE[v]]}
            valeur={genre}
            pose={setGenre}
          />
          <Text style={[styles.aide, { color: couleurs.textMention }]}>{t.champGenreAide}</Text>
        </View>

        <View style={[styles.bloc]}>
          <SectionLabel>{t.champRegistre}</SectionLabel>
          <Choix
            options={PERSON_REGISTERS}
            libelle={(v) => t[CLES_DE_REGISTRE[v]]}
            valeur={registre}
            pose={setRegistre}
          />
          <Text style={[styles.aide, { color: couleurs.textMention }]}>{t.identiteRegistreAide}</Text>
        </View>

        <View style={[styles.bloc]}>
          <SectionLabel>{t.champCanal}</SectionLabel>
          <Choix
            options={CONTACT_CHANNELS}
            libelle={(v) => t[CLES_DE_CANAL[v]]}
            valeur={canal}
            pose={setCanal}
          />
          <Text style={[styles.aide, { color: couleurs.textMention }]}>{t.champCanalAide}</Text>
        </View>

        <View style={[styles.bloc]}>
          <TextField label={t.champVille} value={ville} onChangeText={setVille} hint={t.champVilleAide} />
        </View>

        {erreur ? (
          <Text style={[styles.erreur, { color: couleurs.feedbackError }]}>{erreur}</Text>
        ) : null}

        <Button
          variant="primary"
          full
          disabled={envoi || !pret || !nom.trim() || (creation && !genre)}
          onPress={() => void enregistre()}
          style={{ marginTop: nativeSpace[24] }}
        >
          {t.enregistrer}
        </Button>

        {/* La suppression vit en bas, en rouge de contour : trouvable sans
            être offerte. Absente à la création — il n'y a rien à supprimer. */}
        {creation ? null : (
          <View style={[styles.danger, { borderTopColor: couleurs.borderHairline }]}>
            <Button
              variant="destructiveOutline"
              full
              icon="trash-2"
              disabled={envoi}
              onPress={() => void supprime()}
            >
              {t.identiteSupprimer}
            </Button>
            <Text style={[styles.aideCentre, { color: couleurs.textMention }]}>
              {t.identiteSupprimerAide}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  /* Reprises telles quelles de l'écran d'événement : le jour et le mois s'y
     choisissent de la même façon, et deux dessins pour un même geste se
     mettraient à diverger. */
  sousTitre: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[12] },
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[6], marginTop: nativeSpace[8] },
  rangee: { flexDirection: "row", gap: nativeSpace[6], paddingTop: nativeSpace[8] },
  pastille: {
    minHeight: 38, minWidth: 38, paddingHorizontal: nativeSpace[14],
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: nativeSpace[6],
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width,
  },
  pastilleTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
  bascule: { marginTop: nativeSpace[12] },

  retour: { width: 44, height: 44, marginLeft: -nativeSpace[12], alignItems: "center", justifyContent: "center" },
  entete: { flexDirection: "row", alignItems: "center", gap: nativeSpace[12], marginBottom: nativeSpace[16] },
  titres: { flex: 1, minWidth: 0 },
  titre: { fontFamily: nativeFont.displayRegular, fontSize: 20 },
  intro: { fontFamily: nativeFont.bodyRegular, fontSize: 13, marginTop: 1 },
  champs: { gap: nativeSpace[14] },
  bloc: { marginTop: nativeSpace[20] },
  aide: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[8] },
  aideCentre: { fontFamily: nativeFont.bodyRegular, fontSize: 12, textAlign: "center", marginTop: nativeSpace[8] },
  erreur: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[12] },
  danger: { marginTop: nativeSpace[28], paddingTop: nativeSpace[24], borderTopWidth: nativeBorder.width },
});

/* TROISIÈME COPIE DE CETTE PASTILLE — après `note.tsx` et `evenement.tsx`, qui
   la définissent chacun de son côté avec des noms de props différents (`onPress`
   là, `appuie` ici). Elle mérite d'être extraite dans `composants/` ; je ne le
   fais pas dans le même commit que le champ qui manquait, pour que la
   correction reste lisible. */
function Pastille({ actif, libelle, appuie }: {
  actif: boolean;
  libelle: string;
  appuie: () => void;
}) {
  const couleurs = useCouleurs();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      onPress={appuie}
      style={[styles.pastille, {
        borderColor: actif ? "transparent" : couleurs.borderObject,
        backgroundColor: actif ? couleurs.action : "transparent",
      }]}
    >
      <Text style={[styles.pastilleTexte, {
        color: actif ? couleurs.textOnAccent : couleurs.textSecondary,
      }]}>{libelle}</Text>
    </Pressable>
  );
}

const JOURS = Array.from({ length: 31 }, (_, i) => i + 1);

