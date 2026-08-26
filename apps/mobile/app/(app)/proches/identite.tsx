import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CONTACT_CHANNELS, PERSON_REGISTERS, PERSON_RELATIONS, personSchema,
  type ContactChannel, type PersonRegister, type PersonRelation,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSpace,
} from "@lehno/tokens";
import {
  Avatar, Button, Icon, SectionLabel, TextField, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../../lib/langue.js";
import { appel, ErreurDApi } from "../../../lib/api.js";
import { messageDErreur } from "../../../lib/session.js";
import {
  CLES_DE_CANAL, CLES_DE_REGISTRE, CLES_DE_RELATION,
} from "../../../lib/libelles.js";

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
    setSouvenir(fiche.relationHint ?? "");
    setRegistre(fiche.register);
    setCanal(fiche.preferredChannel);
    setVille(fiche.city ?? "");
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
        ...(souvenir.trim() ? { relationHint: souvenir.trim() } : {}),
        ...(registre ? { register: registre } : {}),
        ...(canal ? { preferredChannel: canal } : {}),
        ...(ville.trim() ? { city: ville.trim() } : {}),
      };
      if (creation) {
        await appel<unknown>("/me/persons", { method: "POST", body: JSON.stringify(corps) });
      } else {
        await appel<unknown>(`/me/persons/${id}`, { method: "PATCH", body: JSON.stringify(corps) });
      }
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
          disabled={envoi || !pret || !nom.trim()}
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

/* Un choix unique en pastilles. Pas de liste déroulante : trois à sept valeurs
   se lisent d'un coup, et un sélecteur natif cacherait le choix derrière un
   geste de plus. Réappuyer sur la pastille active la retire — un lien choisi
   par erreur doit pouvoir se défaire sans vider la fiche. */
function Choix<T extends string>({ options, libelle, valeur, pose }: {
  options: readonly T[];
  libelle: (valeur: T) => string;
  valeur: T | null;
  pose: (valeur: T | null) => void;
}) {
  const couleurs = useCouleurs();
  return (
    <View style={[styles.pastilles]}>
      {options.map((o) => {
        const actif = valeur === o;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityState={{ selected: actif }}
            onPress={() => pose(actif ? null : o)}
            style={[styles.pastille, {
              borderColor: actif ? "transparent" : couleurs.borderObject,
              backgroundColor: actif ? couleurs.action : "transparent",
            }]}
          >
            <Text style={[styles.pastilleTexte, {
              color: actif ? couleurs.textOnAccent : couleurs.textSecondary,
            }]}>{libelle(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  retour: { width: 44, height: 44, marginLeft: -nativeSpace[12], alignItems: "center", justifyContent: "center" },
  entete: { flexDirection: "row", alignItems: "center", gap: nativeSpace[12], marginBottom: nativeSpace[16] },
  titres: { flex: 1, minWidth: 0 },
  titre: { fontFamily: nativeFont.displayRegular, fontSize: 20 },
  intro: { fontFamily: nativeFont.bodyRegular, fontSize: 13, marginTop: 1 },
  champs: { gap: nativeSpace[14] },
  bloc: { marginTop: nativeSpace[20] },
  aide: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[8] },
  aideCentre: { fontFamily: nativeFont.bodyRegular, fontSize: 12, textAlign: "center", marginTop: nativeSpace[8] },
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[6], marginTop: nativeSpace[8] },
  pastille: {
    minHeight: 38, paddingHorizontal: nativeSpace[14], justifyContent: "center",
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width,
  },
  pastilleTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
  erreur: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[12] },
  danger: { marginTop: nativeSpace[28], paddingTop: nativeSpace[24], borderTopWidth: nativeBorder.width },
});
