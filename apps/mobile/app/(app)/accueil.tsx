import { useCallback, useEffect, useState } from "react";
import {
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  estActive, generationsSchema, homeSchema, wishlistListSchema,
  type Home, type Occurrence,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin,
  nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, EmptyState, EventCard, Icon, LoadingState, NotificationBell,
  SectionLabel, Toast, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { ecranEteint, preparationOuverte } from "../../lib/navigation.js";
import { composeLesReprises } from "../../lib/reprises.js";
import {
  REMPLISSAGE_PLEIN, composeLAccueil, doitRepartirDuMaximum, etatDeLAccueil,
  inviteAFaireUneListe,
  resumeDeLAccueil,
  retrecit, type Remplissage,
} from "../../lib/accueil.js";
import { dateCourte } from "../../lib/carnet.js";
import { libelleDeLEcheance } from "../../lib/libelles.js";

/* L'accueil — §3.2.
 *
 * IL NE DÉFILE PAS. C'est un écran qu'on regarde, pas qu'on parcourt : il se
 * remplit à la hauteur MESURÉE, et ce qui n'y tient pas s'en va — jamais en
 * silence, le lien vers Dates porte le compte.
 *
 * Mesurer plutôt que calculer : les marges, les filets et la hauteur d'une
 * ligne changent avec la langue et le modèle, et une constante finit toujours
 * par rogner un rang.
 *
 * Le tirer-pour-rafraîchir vaut ici : ce que l'écran montre change avec
 * l'horloge, et un décompte périmé ment sur la seule chose que le produit
 * promet.
 */
export default function Accueil() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const { actives } = useDrapeaux();
  const routeur = useRouter();

  const [home, setHome] = useState<Home | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [rafraichit, setRafraichit] = useState(false);
  const [envoyes, setEnvoyes] = useState<Record<string, true>>({});
  const [accuse, setAccuse] = useState<string | null>(null);
  const [reprises, setReprises] = useState(0);

  /* Le remplissage ne se calcule pas, il se mesure — et la mesure NE FAIT QUE
     RÉTRÉCIR. Repartir du maximum à chaque rendu faisait osciller les deux
     gestes l'un contre l'autre, sans fin. */
  /* `null` = pas encore su. On n'invite PAS tant qu'on ne sait pas : une
     invitation qui paraît puis s'efface au retour de la requête clignote sur
     l'écran le plus vu de l'application. */
  const [aUneListe, setAUneListe] = useState<boolean | null>(null);
  const [remplissage, setRemplissage] = useState<Remplissage>(REMPLISSAGE_PLEIN);
  const [hauteur, setHauteur] = useState<number | null>(null);

  /* CE QUI ATTEND SE COMPTE AVEC LE MÊME PRÉDICAT QUE L'ÉCRAN QUI LE MONTRE.
     `composeLesReprises` décide de ce qui compte comme « en cours » — un
     lancement raté n'y est pas, une nature éteinte non plus. Recompter ici à la
     main donnerait deux vérités, et la bannière annoncerait deux choses là où
     l'écran n'en montrerait qu'une.

     Les ÉCHÉANCES ne sont pas demandées : elles ne servent qu'à nommer les
     cartes — « mieux vaut une carte sans nom qu'un nom emprunté ». Le COMPTE,
     lui, n'en a pas besoin, et les charger doublerait le coût de l'accueil pour
     une information qu'il n'affiche pas. */
  const compteLesReprises = useCallback(async (): Promise<number> => {
    if (ecranEteint("reprises", actives)) return 0;
    try {
      const brutes = await appel<unknown>("/me/generations", { gouvernee: true });
      return composeLesReprises(generationsSchema.parse(brutes).generations, [], actives).length;
    } catch {
      /* Le compte n'est pas la raison d'être de l'écran : son échec ne doit pas
         empêcher l'accueil de s'afficher. Sans bannière, on perd un rappel ;
         avec une erreur, on perd l'écran. */
      return 0;
    }
  }, [actives]);

  /* SAVOIR S'IL EXISTE DÉJÀ UNE LISTE, pour ne pas inviter à en faire une.
     Le drapeau éteint, on ne demande même pas : la ligne ne paraîtra pas de
     toute façon, et c'est un aller-retour épargné sur l'écran le plus ouvert.

     `/me/home` ne porte pas cette information — c'est signalé au serveur. En
     l'attendant, l'appel part EN PARALLÈLE des autres, jamais à la file.

     En cas d'échec on répond « il y en a une », donc on n'invite pas : offrir
     de faire une liste à quelqu'un qui en a déjà est le reproche que la planche
     nomme, et le silence coûte moins cher. */
  const regardeSiListe = useCallback(async (): Promise<boolean> => {
    if (!estActive(actives, "wishlist.own")) return true;
    try {
      return wishlistListSchema.parse(await appel<unknown>("/me/wishlists")).length > 0;
    } catch {
      return true;
    }
  }, [actives]);

  const charge = useCallback(async () => {
    try {
      /* En PARALLÈLE : l'accueil est l'écran qu'on ouvre le plus, et deux
         allers-retours en file l'un derrière l'autre doubleraient son attente
         pour une bannière. */
      const [brut, combien, deja] = await Promise.all([
        appel<unknown>("/me/home"),
        compteLesReprises(),
        regardeSiListe(),
      ]);
      setHome(homeSchema.parse(brut));
      setReprises(combien);
      setAUneListe(deja);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue, compteLesReprises]);

  useEffect(() => { void charge(); }, [charge]);
  // Au retour d'un autre onglet : une date ajoutée ailleurs doit se voir ici.
  useFocusEffect(useCallback(() => { void charge(); }, [charge]));

  if (echec) {
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

  if (!home) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const etat = etatDeLAccueil(home);
  const { cartes, rangs, reste } = composeLAccueil(
    home.occurrences, remplissage, home.remainingOccurrences,
  );
  const preparer = preparationOuverte(actives);

  /* Le carnet neuf ne poursuit qu'UN BUT : conduire au premier ajout.
     « Laisser une note » céderait la place — il n'y a personne à propos de qui
     écrire. C'est `hasPersons` qui distingue les deux vides. */
  if (etat === "premier") {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        <EmptyState
          illustration="carnet-neuf"
          title={t.videCarnetTitre}
          text={t.videCarnetTexte}
          actionLabel={t.ajouterAnniversaire}
          /* VERS LE PROCHE, PAS VERS LA DATE — et l'écran le dit lui-même :
             « Ajoutez un premier proche ET sa date ». Le proche d'abord.

             La planche envoie ici sur `evenement`, et cela ne peut pas aboutir
             sur un carnet vide : la feuille demande POUR QUI, la recherche ne
             trouve personne, et elle n'offre aucun moyen d'en créer un. La
             planche masque même le sélecteur quand il n'y a aucun candidat —
             le premier geste de l'application ouvrait donc un formulaire
             impossible à remplir.

             Créer un proche demande un nom ET un genre (`createPersonSchema`
             les exige tous deux — « en français on n'écrit pas à quelqu'un sans
             le savoir »). Ce n'est pas un sous-formulaire qu'on glisse dans une
             feuille : c'est l'écran d'identité, qui existe déjà. La date suit,
             depuis la fiche. */
          onAction={() => routeur.push("/(app)/proches/identite")}
        />
      </View>
    );
  }

  /* UNE LIGNE, UN CHEVRON — proposée sans insister. C'est « l'autre moitié du
     produit » : on tient les dates des autres, on peut aussi dire ce qu'on
     voudrait. La planche la pose dans l'état nominal ET dans l'état vide, où
     l'écran n'a précisément rien d'autre à offrir. */
  const invitation = aUneListe !== null && inviteAFaireUneListe(etat, aUneListe, actives) ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => routeur.push("/(app)/listes")}
      style={[styles.invitation, { borderTopColor: couleurs.borderHairline }]}
    >
      <Icon name="gift" size={17} color={couleurs.textMention} />
      <View style={styles.pleine}>
        <Text style={[styles.invitationTitre, { color: couleurs.textAccent }]}>
          {t.accueilFaireListe}
        </Text>
        <Text style={[styles.invitationSous, { color: couleurs.textMention }]} numberOfLines={1}>
          {t.accueilFaireListeSous}
        </Text>
      </View>
      <Icon name="chevron-right" size={15} color={couleurs.textMention} />
    </Pressable>
  ) : null;

  const quoi = (e: Occurrence): string => [
    libelleDeLEcheance(e.kind, e.label, t),
    dateCourte(e.occurrenceDate, langue),
  ].join(" · ");

  const decompte = (e: Occurrence): string =>
    e.daysUntil === 0 ? t.aujourdhui : t.decompteBarre(e.daysUntil);

  return (
    <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
      <View style={styles.salutation}>
        <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.salut(home.firstName)}</Text>
        {/* LE DÉCOMPTE VIENT DE `/me/home`, jamais d'un second appel : le
            contrat le sert là exprès, et « les deux passent par le même
            prédicat côté serveur, donc ils ne peuvent pas se contredire ».
            Deux `where` recopiés, eux, auraient divergé au premier ajout. */}
        {/* LA CLOCHE VIENT DU KIT. J'en avais dessiné une seconde ici — une
            pastille sans nombre —, et deux cloches auraient divergé à la
            première retouche du design system, celle de l'accueil restant en
            arrière sans que rien ne le signale. Celle du kit porte le NOMBRE,
            et c'est mieux : « trois choses vous attendent » décide d'ouvrir,
            « il y a quelque chose » fait seulement hésiter. */}
        <NotificationBell
          unread={home.unreadNotifications}
          label={t.notifsCloche(home.unreadNotifications)}
          onPress={() => routeur.push("/(app)/notifications")}
        />
      </View>

      {/* CE QUI ATTEND PASSE AVANT CE QUI VIENT. Un brouillon commencé et
          jamais fini est une dette qu'on a contractée soi-même : la rappeler
          sous la liste des dates la ferait rater par ceux qui s'arrêtent au
          premier écran, c'est-à-dire presque tout le monde.

          La bannière ne paraît QUE s'il y a quelque chose — « 0 chose vous
          attend » apprendrait à ne plus la lire. */}
      {reprises > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => routeur.push("/(app)/reprises")}
          style={styles.rappel}
        >
          <Banner intent="info">
            {reprises === 1 ? t.reprisesUne : t.reprisesN(reprises)}
          </Banner>
        </Pressable>
      ) : null}

      {etat === "vide" ? (
        <>
          <EmptyState illustration="rien-approche" title={t.videRienTitre} text={t.videRienTexte} />
          {/* Le carnet est rempli, mais rien n'approche : la note demeure, et
              c'est tout ce que l'écran a à proposer. Sans proche désigné — on
              le choisit dans la feuille. */}
          <View style={styles.pied}>
            <Button variant="primary" full icon="plus" onPress={() => routeur.push("/note")}>
              {t.laisserNote}
            </Button>
            {invitation}
          </View>
        </>
      ) : (
        <>
          {/* LE RÉSUMÉ, avant la liste. L'écran montrait ce qui vient sans
              jamais le DIRE : sept phrases écrites au dictionnaire n'étaient
              posées nulle part, et il fallait compter les cartes soi-même pour
              savoir si la semaine était chargée. C'est ce qu'on vient lire en
              premier, avant même de regarder qui. */}
          <Text style={[styles.resume, { color: couleurs.textSecondary }]}>
            {phraseDuResume(resumeDeLAccueil(home), t, langue)}
          </Text>

          <View style={styles.entete}>
            <SectionLabel>{t.ceQuiApproche}</SectionLabel>
            {/* « Voir plus » quand il en reste, « Voir tout » sinon. Le compte
                vient du serveur : `/me/home` ne rend que les plus proches, et
                sans `remainingOccurrences` ce lien aurait toujours dit « tout »
                alors qu'il en manquait vingt.

                Il mène à Dates, la même liste en entier. */}
            <Text
              accessibilityRole="button"
              onPress={() => routeur.push("/(app)/dates")}
              style={[styles.voir, { color: couleurs.textAccent }]}
            >
              {reste ? t.voirPlus : t.voirTout}
            </Text>
          </View>

          {/* La zone mesurée. `onLayout` donne la hauteur disponible,
              `onContentSizeChange` celle du contenu : c'est le couple que le
              kit lit en `clientHeight` / `scrollHeight`, et il n'existe pas
              autrement en natif. */}
          <ScrollView
            scrollEnabled={false}
            style={styles.zone}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (doitRepartirDuMaximum(h, hauteur)) setRemplissage(REMPLISSAGE_PLEIN);
              setHauteur(h);
            }}
            onContentSizeChange={(_, hContenu) => {
              if (hauteur !== null && hContenu > hauteur) {
                const moins = retrecit(remplissage);
                if (moins) setRemplissage(moins);
              }
            }}
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
            {cartes.map((e, rang) => (
              <View key={e.id} style={{ marginBottom: nativeSpace[12] }}>
                <EventCard
                  name={e.personDisplayName}
                  what={quoi(e)}
                  countdownLabel={decompte(e)}
                  today={e.daysUntil === 0}
                  featured={rang === 0}
                  /* TOUTE carte ouvre son occasion. C'est la seule route qui
                     porte l'occurrence, et préparer en a besoin : jusqu'ici
                     l'accueil ne menait nulle part depuis une échéance. */
                  onPress={() => routeur.push({
                    pathname: "/(app)/occasion", params: { occurrenceId: e.id },
                  })}
                  {...(rang === 0 ? (preparer ? {
                    /* « Préparer » sur la PREMIÈRE seulement. Le geste coûte un
                       crédit : le proposer sur trois cartes d'affilée en ferait
                       une barre d'outils au lieu d'une invitation. */
                    prepareLabel: t.preparer,
                    onPrepare: () => routeur.push({
                      pathname: "/(app)/preparation", params: { occurrenceId: e.id },
                    }),
                  } : {
                    /* GÉNÉRATION ÉTEINTE : l'action CHANGE D'IDENTITÉ, elle ne
                       disparaît pas. La planche est explicite — la carte « ne
                       doit pas paraître amputée » : sans message à produire,
                       son geste devient celui du socle, noter une idée pour la
                       date qui approche. Une action au lieu de deux, mais une
                       action pleine.

                       Ce n'est pas un cas limite : les idées et le portrait
                       sont refusés au contrôleur, et le message peut être
                       éteint au lancement. C'est donc l'état PROBABLE le jour
                       de l'ouverture, sur l'écran le plus vu. */
                    prepareLabel: t.cartNoter,
                    onPrepare: () => routeur.push({
                      pathname: "/note", params: { personId: e.personId },
                    }),
                  }) : {})}
                  {...(rang === 0 && preparer && !envoyes[e.id] ? {
                    /* « Marquer envoyé » ne mène à aucun écran : c'est un état
                       qui change ici, et l'accusé dit à qui. La carte cesse
                       ensuite de le proposer — rien ne s'envoie deux fois. */
                    markSentLabel: t.marquerEnvoye,
                    onMarkSent: () => {
                      setEnvoyes((v) => ({ ...v, [e.id]: true }));
                      setAccuse(t.envoiFait(e.personDisplayName));
                    },
                  } : {})}
                />
              </View>
            ))}

            {rangs.map((e) => (
              <View key={e.id} style={[styles.rang, { borderTopColor: couleurs.borderHairline }]}>
                <Text style={[styles.rangNom, { color: couleurs.textBody }]} numberOfLines={1}>
                  {e.personDisplayName}
                </Text>
                <Text style={[styles.rangQuoi, { color: couleurs.textSecondary }]} numberOfLines={1}>
                  {quoi(e)}
                </Text>
              </View>
            ))}
          </ScrollView>
          {invitation}
        </>
      )}

      {accuse ? <Toast intent="success" onDismiss={() => setAccuse(null)}>{accuse}</Toast> : null}
    </View>
  );
}

/* La phrase, choisie hors du rendu : la décision est dans `resumeDeLAccueil`,
   ici il ne reste qu'à la dire. Séparer les deux permet d'éprouver la table
   sans rendu — `react-native` étant typé Flow, un test qui monterait l'écran ne
   se compilerait pas. */
function phraseDuResume(
  resume: ReturnType<typeof resumeDeLAccueil>,
  t: ReturnType<typeof useLangue>["t"],
  langue: ReturnType<typeof useLangue>["langue"],
): string {
  switch (resume.sorte) {
    case "rien": return t.etatRien;
    case "lointain": return t.etatLointain(dateCourte(resume.date, langue));
    case "aujourdhui": return t.etatUnAujourdhui;
    case "aujourdhuiEtSemaine": return t.etatUnAujourdhuiEtSemaine(resume.autres);
    case "semaine":
      /* Le designer a écrit UNE et DEUX en toutes lettres, et le reste en
         chiffre : « Une date », « Deux dates », puis « 5 dates ». On respecte
         sa coupure plutôt que d'uniformiser — c'est ce qui fait qu'une phrase
         se lit comme une phrase et non comme un compteur. */
      if (resume.combien === 1) return t.etatUnSemaine;
      if (resume.combien === 2) return t.etatDeuxSemaine;
      return t.etatPlusieursSemaine(resume.combien);
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: nativeSpace[16] },
  rappel: { marginBottom: nativeSpace[12] },
  resume: {
    fontFamily: nativeFont.bodyRegular, fontSize: 14,
    marginTop: nativeSpace[4], marginBottom: nativeSpace[16],
  },
  salutation: { flexDirection: "row", alignItems: "center", gap: nativeSpace[8] },
  titre: {
    flex: 1,
    fontFamily: nativeFont.displayMedium, fontSize: 27,
    letterSpacing: nativeLetterSpacing(27, nativeTracking.display),
    marginBottom: nativeSpace[16],
  },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: nativeSpace[12] },
  voir: {
    marginLeft: "auto", fontFamily: nativeFont.bodyRegular, fontSize: 13,
    minHeight: nativeTouchMin, textAlignVertical: "center", lineHeight: nativeTouchMin,
  },
  // La zone se borne à ce qui reste : c'est elle qu'on mesure, pas la page.
  zone: { flex: 1 },
  rang: { paddingVertical: nativeSpace[10], borderTopWidth: 1 },
  rangNom: { fontFamily: nativeFont.displayRegular, fontSize: 16 },
  rangQuoi: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: 2 },
  pied: { marginTop: "auto", paddingTop: nativeSpace[20] },
  /* Un filet la sépare de ce qui précède : elle n'est pas du même ordre que
     les échéances, et sans trait elle se lirait comme une quatrième carte. */
  invitation: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    marginTop: nativeSpace[12], paddingTop: nativeSpace[12],
    minHeight: nativeTouchMin, borderTopWidth: nativeBorder.width,
  },
  pleine: { flex: 1, minWidth: 0 },
  invitationTitre: { fontFamily: nativeFont.bodySemibold, fontSize: 14 },
  invitationSous: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: 1 },
});
