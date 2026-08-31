import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { personListSchema, type Person } from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSpace, nativeTouchMin,
} from "@lehno/tokens";
import { Avatar, Countdown, EmptyState, Icon, Tag, useCouleurs } from "@lehno/ui-native";
import { useLangue } from "../../../lib/langue.js";
import { appel } from "../../../lib/api.js";
import {
  chercheVraiment, dateCourte, parametresDeRecherche, presseAssezPourSAfficher,
} from "../../../lib/carnet.js";
import { libelleDeLEcheance } from "../../../lib/libelles.js";

/* La recherche.
 *
 * ELLE SE PARCOURT : sans saisie, elle montre le début du carnet plutôt qu'une
 * page blanche — chercher commence souvent par parcourir.
 *
 * ELLE CHERCHE AU SERVEUR. Elle a filtré en mémoire, faute de `?q=` : l'écran
 * tirait le carnet ENTIER par pages de cent avant de chercher dedans. Tenable à
 * dix fiches, plus à trois cents — quatre allers-retours avant la première
 * lettre tapée, refaits à chaque ouverture. Le paramètre existe désormais, et
 * il vit sur le même chemin que la liste pour se combiner au tri.
 *
 * ON N'INTERROGE PAS À CHAQUE FRAPPE : une pause, et deux caractères au
 * minimum — une seule lettre rend presque tout le carnet, l'appel coûte autant
 * que la liste et n'apprend rien.
 */

export default function Recherche() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [saisie, setSaisie] = useState("");
  const [resultats, setResultats] = useState<Person[] | null>(null);

  /* Le tri ALPHABÉTIQUE pour parcourir : sans saisie, on cherche un nom dans
     une liste. La recherche le garde — le contrat veut qu'elle « se combine au
     tri », et changer l'ordre au premier caractère tapé ferait sauter la ligne
     qu'on visait. */
  const tri = { cle: "alpha", sens: "asc" } as const;

  useEffect(() => {
    let vivant = true;
    /* La pause ne s'applique qu'à la RECHERCHE. Le premier chargement — sans
       saisie — part tout de suite : attendre quatre cents millisecondes pour
       montrer une liste qu'on a déjà demandée serait un blanc gratuit. */
    const q = saisie.trim();
    const attente = chercheVraiment(q) ? 400 : 0;

    const minuteur = setTimeout(() => {
      void (async () => {
        try {
          const lu = personListSchema.parse(await appel<unknown>(
            `/me/persons${parametresDeRecherche(tri, 0, chercheVraiment(q) ? q : "")}`,
          ));
          if (vivant) setResultats(lu.persons);
        } catch {
          /* On garde ce qu'on montrait : effacer la liste sur un échec de
             réseau ferait croire à un carnet vide, et c'est la pire chose à
             montrer à quelqu'un qui cherche quelqu'un. */
        }
      })();
    }, attente);

    /* Le nettoyage annule la demande en vol : sans lui, la réponse d'un mot
       abandonné écraserait celle du mot qu'on vient de taper — et l'écran
       montrerait les résultats d'une recherche qu'on ne fait plus. */
    return () => { vivant = false; clearTimeout(minuteur); };
  }, [saisie]);

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage, paddingTop: insets.top + nativeSpace[6] }}>
      <View style={[styles.barre]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.retour}
          onPress={() => routeur.back()}
          style={[styles.retour]}
        >
          <Icon name="chevron-left" size={22} color={couleurs.textBody} />
        </Pressable>
        <View style={[styles.champ, { borderColor: couleurs.action }]}>
          <Icon name="search" size={17} color={couleurs.textMention} />
          <TextInput
            value={saisie}
            onChangeText={setSaisie}
            placeholder={t.rechercher}
            placeholderTextColor={couleurs.textMention}
            accessibilityLabel={t.rechercher}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={[styles.saisie, { color: couleurs.textBody }]}
          />
          {saisie ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t.effacer} onPress={() => setSaisie("")}>
              <Icon name="x" size={15} strokeWidth={2} color={couleurs.textMention} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: nativeSpace[16],
          paddingBottom: insets.bottom + nativeSpace[20],
        }}
        keyboardShouldPersistTaps="handled"
      >
        {resultats?.length ? (
          resultats.map((p, rang) => {
            const jours = p.nextOccurrence?.daysUntil ?? null;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => routeur.push({ pathname: "/(app)/proches/[id]", params: { id: p.id } })}
                style={[styles.ligne, rang ? {
                  borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
                } : null]}
              >
                <Avatar name={p.displayName} size={40} {...(p.avatarUrl ? { source: p.avatarUrl } : {})} />
                <View style={[styles.identite]}>
                  <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
                    {p.displayName}
                  </Text>
                  {p.nextOccurrence ? (
                    <View style={[styles.repere]}>
                      <Tag tone={p.nextOccurrence.kind === "birthday" ? "outline" : "quiet"}>
                        {libelleDeLEcheance(p.nextOccurrence.kind, p.nextOccurrence.label, t)}
                      </Tag>
                      <Text style={[styles.date, { color: couleurs.textSecondary }]}>
                        {dateCourte(p.nextOccurrence.occurrenceDate, langue)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {presseAssezPourSAfficher(jours) ? (
                  <Countdown
                    size="s"
                    today={jours === 0}
                    label={jours === 0 ? t.aujourdhui : t.decompteBarre(jours ?? 0)}
                  />
                ) : null}
              </Pressable>
            );
          })
        ) : resultats === null ? null : (
          <EmptyState
            illustration="recherche-sans-resultat"
            title={t.videRechercheTitre}
            text={t.videRechercheTexte}
            actionLabel={t.ajouterCeProche}
            onAction={() => routeur.push("/(app)/proches/identite")}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[8],
    paddingHorizontal: nativeSpace[12], paddingBottom: nativeSpace[12],
  },
  retour: { width: nativeTouchMin, height: nativeTouchMin, alignItems: "center", justifyContent: "center", marginLeft: -nativeSpace[8] },
  champ: {
    flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: nativeSpace[8],
    minHeight: nativeTouchMin, paddingHorizontal: nativeSpace[12],
    borderRadius: nativeRadius.sm, borderWidth: nativeBorder.width,
  },
  saisie: { flex: 1, minWidth: 0, fontFamily: nativeFont.bodyRegular, fontSize: 16 },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
  },
  identite: { flex: 1, minWidth: 0 },
  nom: { fontFamily: nativeFont.displayRegular, fontSize: 16 },
  repere: { flexDirection: "row", alignItems: "center", gap: nativeSpace[6], marginTop: 2 },
  date: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5 },
});
