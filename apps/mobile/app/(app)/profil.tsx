import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  PERSON_GENDERS, profileSchema, usernameAvailabilitySchema, type Profile,
} from "@lehno/contracts";
import { nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Avatar, Banner, Button, Icon, LoadingState, SectionLabel, TextField, useTheme,
} from "@lehno/ui-native";
import { Choix } from "../../composants/Choix.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { CLES_DE_GENRE, CLES_DE_THEME, THEMES_ORDONNES } from "../../lib/libelles.js";
import { poseLApparence } from "../../lib/apparence.js";
import {
  corpsDeMiseAJour, doitVerifierLaDisponibilite, peutEnregistrer, pseudoRecevable,
  type SaisieDeProfil,
} from "../../lib/profil.js";
import { choisirUnePhoto, envoyerLaPhoto, retirerLaPhoto } from "../../lib/photo-de-profil.js";
import { imageLocale, oublierLesAutres } from "../../lib/images-locales.js";

/* Mon profil — §3.23.
 *
 * CE QUI SE CHANGE ICI se lit dans ce que le contrat accepte, pas dans ce que
 * la maquette dessine. `updateProfileSchema` prend le pseudo, le nom, la langue
 * et le genre. Pas l'adresse.
 *
 * LA PHOTO NE PASSE PAS PAR CE FORMULAIRE, et ce n'est pas un oubli : elle ne
 * s'envoie pas au serveur mais DIRECTEMENT au stockage, sur une URL qu'il
 * signe. Une URL ne se pose donc jamais à la main — sinon n'importe qui ferait
 * pointer son avatar où il veut.
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
  const { t, langue, choisis } = useLangue();
  const { couleurs, choisis: choisisLeTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [profil, setProfil] = useState<Profile | null>(null);
  const [saisie, setSaisie] = useState<SaisieDeProfil | null>(null);
  const [libre, setLibre] = useState<boolean | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [photoEnCours, setPhotoEnCours] = useState(false);
  /* Le fichier LOCAL, pas l'URL du serveur : une photo de profil ne change pas
     trois fois par jour, et la retélécharger à chaque écran coûte du forfait
     pour rien. Nul tant qu'on ne l'a pas — l'avatar montre alors ses initiales,
     ce qui est un état, pas une erreur. */
  const [photoLocale, setPhotoLocale] = useState<string | null>(null);

  /* Le refus de permission n'est pas une panne : il est durable, et l'écran dit
     où le reprendre plutôt que de laisser un bouton qui n'ouvre rien.
     L'annulation, elle, ne dit rien — on vient de fermer le sélecteur soi-même. */
  const changerLaPhoto = async (): Promise<void> => {
    const choix = await choisirUnePhoto();
    if (choix.issue === "refusee") { setEchec(t.photoRefusee); return; }
    // Le rétrécissement se fait sur le cas RETENU : lister les deux autres
    // laisse TypeScript avec l'union entière.
    if (choix.issue !== "choisie") return;

    setPhotoEnCours(true);
    setEchec(null);
    try {
      const misAJour = await envoyerLaPhoto(choix.photo);
      setProfil(misAJour);
      // La nouvelle porte une clé neuve : l'ancienne ne sert plus à rien.
      await oublierLesAutres([misAJour.avatarKey]);
      setPhotoLocale(await imageLocale(misAJour.avatarKey));
    } catch (souci) {
      setEchec(souci instanceof Error && souci.message === "trop_lourde"
        ? t.photoTropLourde
        : t.photoEchec);
    } finally {
      setPhotoEnCours(false);
    }
  };

  const retirerLaSienne = async (): Promise<void> => {
    setPhotoEnCours(true);
    setEchec(null);
    try {
      setProfil(await retirerLaPhoto());
      setPhotoLocale(null);
      await oublierLesAutres([]);
    } catch {
      setEchec(t.photoEchec);
    } finally {
      setPhotoEnCours(false);
    }
  };

  const charge = useCallback(async () => {
    try {
      const lu = profileSchema.parse(await appel<unknown>("/me/profile"));
      setProfil(lu);
      /* La photo se sert du DISQUE si on l'a déjà — un aller-retour de moins, et
         elle paraît même sans réseau. Sinon elle se télécharge une fois, et
         restera. */
      void imageLocale(lu.avatarKey).then(setPhotoLocale);
      /* Ouvrir cet écran RÉCONCILIE les deux : l'appareil peut avoir changé de
         langue, ou le compte avoir été réglé depuis un autre téléphone. Ce que
         le serveur a retenu fait foi — c'est lui qui envoie les courriels. */
      choisis(lu.uiLanguage);
      /* Le serveur fait foi, ICI AUSSI : le compte a pu être réglé depuis un
         autre téléphone. On applique, et on garde localement pour que le
         PROCHAIN lancement parte du bon thème sans attendre cet appel. */
      choisisLeTheme(lu.theme);
      void poseLApparence(lu.theme);
      setSaisie({
        pseudo: lu.username,
        nom: lu.displayName ?? "",
        genre: lu.gender,
        langue: lu.uiLanguage,
        theme: lu.theme,
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
      /* L'INTERFACE SUIT LE RÉGLAGE, sinon il ne règle rien de ce qu'on voit.
         Sans cet appel, changer « Langue » ne changeait QUE la langue des
         courriels — en silence, sur un écran qui restait dans l'autre langue.
         On l'applique après l'enregistrement : ce qui est affiché correspond
         alors à ce que le serveur a retenu. */
      choisis(saisie.langue);
      choisisLeTheme(saisie.theme);
      void poseLApparence(saisie.theme);
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

      {/* La photo se dépose EN DIRECT sur le stockage, sans traverser l'API :
          le serveur signe une URL, le téléphone monte dessus, puis confirme.
          C'est la confirmation qui relit les octets et recompose l'image — donc
          qui retire les métadonnées, position géographique comprise. */}
      <View style={styles.portrait}>
        <Avatar
          name={saisie.nom || profil.username}
          size={76}
          // Le fichier LOCAL, jamais l'URL : il paraît hors connexion, et sans
          // aller-retour quand tout va bien.
          {...(photoLocale === null ? {} : { src: photoLocale })}
        />
        <View style={styles.photoActions}>
          <Pressable
            accessibilityRole="button"
            disabled={photoEnCours}
            onPress={() => { void changerLaPhoto(); }}
          >
            <Text style={[styles.photoLien, { color: couleurs.textAccent }]}>
              {photoEnCours ? t.photoEnvoi : t.photoChanger}
            </Text>
          </Pressable>
          {/* « Retirer » n'existe que s'il y a quelque chose à retirer : un
              bouton qui ne défait rien fait douter de ce qu'on voit. */}
          {profil.avatarUrl === null ? null : (
            <Pressable
              accessibilityRole="button"
              disabled={photoEnCours}
              onPress={() => { void retirerLaSienne(); }}
            >
              <Text style={[styles.photoLien, { color: couleurs.textAccent }]}>{t.photoRetirer}</Text>
            </Pressable>
          )}
        </View>
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

        <View>
          <SectionLabel>{t.champTheme}</SectionLabel>
          {/* TROIS choix, pas deux. « Système » est la valeur par défaut au
              contrat, et la seule qui laisse l'appareil décider : un sélecteur
              qui n'offrirait que Clair et Sombre forcerait un réglage explicite
              à la première visite, et le passage automatique au sombre le soir
              serait perdu sans que personne ne l'ait demandé. */}
          <Choix
            options={THEMES_ORDONNES}
            libelle={(v) => t[CLES_DE_THEME[v]]}
            valeur={saisie.theme}
            pose={(v) => setSaisie({ ...saisie, theme: v ?? saisie.theme })}
          />
          <Text style={[styles.aide, { color: couleurs.textMention }]}>{t.profilThemeAide}</Text>
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
  photoActions: { flexDirection: "row", gap: nativeSpace[16], marginTop: nativeSpace[10] },
  photoLien: { fontFamily: nativeFont.bodySemibold, fontSize: 14.5 },
  champs: { gap: nativeSpace[14] },
  lecture: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, marginTop: nativeSpace[6] },
  aide: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[6] },
});
