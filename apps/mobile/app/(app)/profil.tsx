import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  PERSON_GENDERS, profileSchema, usernameAvailabilitySchema, type Profile,
} from "@lehno/contracts";
import { nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Avatar, Banner, Button, Icon, LoadingState, SectionLabel, TextField, useCouleurs,
} from "@lehno/ui-native";
import { Choix } from "../../composants/Choix.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { CLES_DE_GENRE } from "../../lib/libelles.js";
import {
  corpsDeMiseAJour, doitVerifierLaDisponibilite, peutEnregistrer, pseudoRecevable,
  type SaisieDeProfil,
} from "../../lib/profil.js";

/* Mon profil — §3.23.
 *
 * CE QUI SE CHANGE ICI se lit dans ce que le contrat accepte, pas dans ce que
 * la maquette dessine. `updateProfileSchema` prend le pseudo, le nom, la
 * langue et le genre. Pas l'adresse, pas la photo.
 *
 * LA MAQUETTE DESSINE L'ADRESSE EN CHAMP MODIFIABLE, et je ne la suis pas :
 * c'est le moyen de connexion. La changer bascule l'identité du compte et
 * demande de vérifier la nouvelle avant que l'ancienne ne cesse de valoir —
 * un parcours qui n'existe pas. Un champ qui se laisse taper puis ne part pas
 * fait croire à une modification qui n'a pas eu lieu, et on ne s'en aperçoit
 * qu'à la prochaine connexion, quand il est trop tard.
 *
 * Elle se montre donc, et ne s'édite pas.
 *
 * LE GENRE N'EST PAS DANS LA MAQUETTE et il est ici quand même : le contrat le
 * réclame nommément à cet écran — « il se renseigne donc au profil (§3.23) ».
 * Nul veut dire « pas encore répondu », et la génération emploie alors des
 * tournures qui s'en passent plutôt qu'un accord au hasard.
 */
export default function Profil() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [profil, setProfil] = useState<Profile | null>(null);
  const [saisie, setSaisie] = useState<SaisieDeProfil | null>(null);
  const [libre, setLibre] = useState<boolean | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const lu = profileSchema.parse(await appel<unknown>("/me/profile"));
      setProfil(lu);
      setSaisie({
        pseudo: lu.username,
        nom: lu.displayName ?? "",
        genre: lu.gender,
        langue: lu.uiLanguage,
      });
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { void charge(); }, [charge]);

  /* LA DISPONIBILITÉ SE DEMANDE APRÈS UNE PAUSE, jamais à chaque frappe :
     « valen » serait interrogé sur le chemin de « valentine », et chaque
     lettre coûterait un aller-retour. Le nettoyage annule la demande en
     cours — sans lui, une réponse tardive sur un pseudo abandonné écraserait
     celle du pseudo qu'on vient de taper. */
  useEffect(() => {
    if (!profil || !saisie) return;
    if (!doitVerifierLaDisponibilite(saisie.pseudo, profil)) { setLibre(null); return; }

    let vivant = true;
    const minuteur = setTimeout(() => {
      void (async () => {
        try {
          const brut = await appel<unknown>(
            `/me/profile/username-available?username=${encodeURIComponent(saisie.pseudo.trim())}`,
          );
          const lu = usernameAvailabilitySchema.parse(brut);
          if (vivant) setLibre(lu.available);
        } catch {
          /* On ne sait pas : le bouton reste éteint plutôt que d'envoyer vers
             un refus qui emporterait les autres champs du formulaire. */
          if (vivant) setLibre(null);
        }
      })();
    }, 400);

    return () => { vivant = false; clearTimeout(minuteur); };
  }, [profil, saisie]);

  const enregistre = async (): Promise<void> => {
    if (!profil || !saisie) return;
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>("/me/profile", {
        method: "PATCH",
        body: JSON.stringify(corpsDeMiseAJour(saisie, profil)),
      });
      routeur.back();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  if (echec && !profil) {
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

  if (!profil || !saisie) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const pris = doitVerifierLaDisponibilite(saisie.pseudo, profil) && libre === false;
  const malForme = saisie.pseudo.trim().length > 0 && !pseudoRecevable(saisie.pseudo);

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[8],
        paddingBottom: insets.bottom + nativeSpace[24],
      }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.retour}
        onPress={() => routeur.back()}
        style={styles.retour}
      >
        <Icon name="chevron-left" size={20} color={couleurs.textBody} />
      </Pressable>

      {/* L'avatar SANS « changer la photo » : aucune route ne l'accepte —
          `updateProfileSchema` ne porte pas `avatarUrl`, et il n'existe pas de
          dépôt de fichier. Le bouton du kit n'ouvrirait rien. */}
      <View style={styles.portrait}>
        <Avatar name={saisie.nom || profil.username} size={76} />
      </View>

      {echec ? (
        <View style={{ marginBottom: nativeSpace[12] }}>
          <Banner intent="error">{echec}</Banner>
        </View>
      ) : null}

      <View style={styles.champs}>
        <TextField
          label={t.champPrenom}
          value={saisie.nom}
          onChangeText={(v) => setSaisie({ ...saisie, nom: v })}
        />

        <TextField
          label={t.champPseudo}
          value={saisie.pseudo}
          nature="pseudo"
          invalid={pris || malForme}
          hint={pris ? t.pseudoPris : t.pseudoAdresse(saisie.pseudo.trim())}
          onChangeText={(v) => setSaisie({ ...saisie, pseudo: v })}
        />

        {/* L'ADRESSE SE LIT, ELLE NE SE TAPE PAS. Un champ de saisie ici
            promettrait une modification que le contrat refuse. */}
        <View>
          <SectionLabel>{t.champEmail}</SectionLabel>
          <Text style={[styles.lecture, { color: couleurs.textSecondary }]}>{profil.email}</Text>
        </View>

        <View>
          {/* DEUX valeurs, parce que c'est un accord et non une identité : un
              accord français n'a que deux formes. Nul reste possible — « pas
              encore répondu » n'est pas un défaut à corriger. */}
          <SectionLabel>{t.champGenre}</SectionLabel>
          <Choix
            options={PERSON_GENDERS}
            libelle={(v) => t[CLES_DE_GENRE[v]]}
            valeur={saisie.genre}
            pose={(v) => setSaisie({ ...saisie, genre: v })}
          />
          <Text style={[styles.aide, { color: couleurs.textMention }]}>{t.profilGenreAide}</Text>
        </View>

        <View>
          <SectionLabel>{t.champLangue}</SectionLabel>
          {/* Un choix, pas un champ libre : deux valeurs se lisent d'un coup, et
              le kit n'offrait qu'un champ parce qu'il ne pouvait rien ouvrir. */}
          <Choix
            options={["fr", "en"] as const}
            libelle={(v) => (v === "fr" ? "Français" : "English")}
            valeur={saisie.langue}
            pose={(v) => setSaisie({ ...saisie, langue: v ?? saisie.langue })}
          />
          <Text style={[styles.aide, { color: couleurs.textMention }]}>{t.profilLangueAide}</Text>
        </View>
      </View>

      <View style={{ marginTop: nativeSpace[28] }}>
        <Button
          full
          disabled={envoi || !peutEnregistrer(saisie, profil, libre)}
          onPress={() => void enregistre()}
        >
          {t.enregistrer}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  portrait: { alignItems: "center", marginTop: nativeSpace[8], marginBottom: nativeSpace[24] },
  champs: { gap: nativeSpace[14] },
  lecture: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, marginTop: nativeSpace[6] },
  aide: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[6] },
});
