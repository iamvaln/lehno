import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  notificationPreferencesSchema, profileSchema,
  type DigestFrequency, type NotificationPreferenceItem,
} from "@lehno/contracts";
import { nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, Icon, LoadingState, SectionLabel, useCouleurs,
} from "@lehno/ui-native";
import { Bascule } from "../../composants/Bascule.js";
import { Choix } from "../../composants/Choix.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import {
  basculeDuGroupe, etatDuGroupe, groupesOfferts, plusRienNeParvient, RYTHMES,
  type Canal, type CleDeGroupe,
} from "../../lib/rappels.js";

/* Rappels et notifications — §3.11.
 *
 * ONZE NATURES, CINQ GROUPES. Le contrat règle chaque nature séparément et
 * refuse de les grouper à notre place : le groupement ne change que
 * l'affichage, jamais ce qui part, et le coder côté serveur créerait une
 * seconde source de vérité qui se figerait.
 *
 * LES HEURES SONT SUR LE PROFIL, pas ici : `sendHour` vaut pour toutes les
 * natures, alors que le rythme du récapitulatif n'en concerne qu'une. Le
 * contrat le range en conséquence ; l'écran les réunit parce qu'on les règle
 * dans le même mouvement.
 */
export default function Rappels() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();

  const [preferences, setPreferences] = useState<NotificationPreferenceItem[] | null>(null);
  const [rythme, setRythme] = useState<DigestFrequency>("weekly");
  const [heure, setHeure] = useState<number | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const [brutPrefs, brutProfil] = await Promise.all([
        appel<unknown>("/me/notification-preferences"),
        appel<unknown>("/me/profile"),
      ]);
      const lu = notificationPreferencesSchema.parse(brutPrefs);
      setPreferences(lu.preferences);
      setRythme(lu.digestFrequency);
      setHeure(profileSchema.parse(brutProfil).sendHour);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { void charge(); }, [charge]);

  /* ON POSE L'ÉTAT AVANT LA RÉPONSE, et on le remet si elle refuse.
     Un interrupteur qui attend un aller-retour avant de bouger donne
     l'impression de ne pas avoir été touché — on rappuie, et deux demandes
     partent en sens contraire. */
  const bascule = async (cle: CleDeGroupe, canal: Canal, valeur: boolean): Promise<void> => {
    if (!preferences) return;
    const groupe = groupesOfferts(actives).find((g) => g.cle === cle);
    if (!groupe) return;

    const changees = basculeDuGroupe(groupe, preferences, canal, valeur);
    const avant = preferences;
    const apres = [
      ...preferences.filter((p) => !changees.some((c) => c.type === p.type)),
      ...changees,
    ];
    setPreferences(apres);
    setEchec(null);
    try {
      await appel<unknown>("/me/notification-preferences", {
        method: "PATCH",
        body: JSON.stringify({ preferences: changees }),
      });
    } catch (e) {
      setPreferences(avant);
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  const poseLeRythme = async (choisi: DigestFrequency): Promise<void> => {
    const avant = rythme;
    setRythme(choisi);
    try {
      await appel<unknown>("/me/notification-preferences", {
        method: "PATCH",
        body: JSON.stringify({ digestFrequency: choisi }),
      });
    } catch (e) {
      setRythme(avant);
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  const poseLHeure = async (choisie: number): Promise<void> => {
    const avant = heure;
    setHeure(choisie);
    try {
      // L'heure d'envoi vit sur le PROFIL : elle vaut pour toutes les natures.
      await appel<unknown>("/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ sendHour: choisie }),
      });
    } catch (e) {
      setHeure(avant);
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  if (echec && preferences === null) {
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

  if (preferences === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={4} title={t.chargement} />
      </View>
    );
  }

  const groupes = groupesOfferts(actives);
  const muet = plusRienNeParvient(groupes, preferences);

  const libelle: Record<CleDeGroupe, string> = {
    avant: t.reglagesJ7,
    jour: t.reglagesJour,
    recap: t.reglagesRecap,
    valider: t.reglagesValider,
    relances: t.reglagesRelances,
    vie: t.reglagesVieCompte,
  };

  /* LES QUATRE HEURES OFFERTES par la maquette. Le contrat en accepte
     vingt-quatre ; on ne propose que celles-là, et une valeur hors liste
     n'active aucune pastille plutôt que d'en cocher une au hasard. */
  const HEURES = ["7", "12", "18", "21"] as const;
  const libelleDHeure = (h: string): string =>
    t.reglagesHeures[HEURES.indexOf(h as (typeof HEURES)[number])] ?? h;

  const canaux: readonly { canal: Canal; libelle: string }[] = [
    { canal: "push", libelle: t.reglagesPush },
    { canal: "email", libelle: t.reglagesEmail },
  ];

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

      {echec ? (
        <View style={{ marginBottom: nativeSpace[12] }}>
          <Banner intent="error">{echec}</Banner>
        </View>
      ) : null}

      {/* L'avertissement du silence, et seulement quand il est vrai : les deux
          canaux fermés PARTOUT. Fermer la poussée en gardant le courriel est un
          réglage ordinaire, et l'annoncer userait l'avertissement. */}
      {muet ? (
        <View style={{ marginBottom: nativeSpace[12] }}>
          <Banner intent="warning">{t.reglagesMuet}</Banner>
        </View>
      ) : null}

      {/* CHAQUE GROUPE SUR SES DEUX CANAUX. La maquette pose « quand » puis
          « par quel moyen » comme deux listes indépendantes ; le contrat règle
          le canal PAR NATURE, donc deux interrupteurs globaux mentiraient dès
          qu'on veut la poussée pour une date et le courriel pour le reste. */}
      {groupes.map((g) => (
        <View key={g.cle} style={styles.bloc}>
          <SectionLabel>{libelle[g.cle]}</SectionLabel>
          {canaux.map(({ canal, libelle: nom }, i) => (
            <Bascule
              key={canal}
              libelle={nom}
              premier={i === 0}
              actif={etatDuGroupe(g, preferences, canal)}
              onBascule={(v) => void bascule(g.cle, canal, v)}
            />
          ))}
          {/* Le récapitulatif n'a pas que des canaux : il a un rythme, et
              « jamais » y remplace l'interrupteur absent. */}
          {g.cle === "recap" ? (
            <Choix
              options={RYTHMES}
              libelle={(r) => (r === "weekly"
                ? t.reglagesRecapFreq[0] ?? r
                : t.reglagesRecapFreq[1] ?? r)}
              valeur={rythme}
              pose={(r) => { if (r) void poseLeRythme(r); }}
            />
          ) : null}
        </View>
      ))}

      <View style={styles.bloc}>
        <SectionLabel>{t.reglagesHeure}</SectionLabel>
        <Choix
          options={HEURES}
          libelle={libelleDHeure}
          valeur={heure !== null && (HEURES as readonly string[]).includes(String(heure))
            ? String(heure) : null}
          pose={(h) => { if (h !== null) void poseLHeure(Number(h)); }}
        />
      </View>

      {/* Les alertes de sécurité ne sont pas dans les natures configurables :
          elles partent quoi qu'il arrive. Le dire ici évite qu'on les cherche
          parmi les interrupteurs — et qu'on croie les avoir coupées. */}
      <Text style={[styles.toujours, { color: couleurs.textMention }]}>
        {t.reglagesSecuriteToujours}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  bloc: { marginTop: nativeSpace[20] },
  toujours: {
    fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[24],
  },
});
