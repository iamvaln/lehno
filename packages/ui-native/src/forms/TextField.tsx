import { Text, TextInput, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { styleDeChamp } from "./TextField.styles.js";
import { nettoiePourLaNature, reglagesDeSaisie, type NatureDeChamp } from "./TextField.nature.js";

export interface TextFieldProps {
  label?: string | undefined;
  hint?: string | undefined;
  value?: string | undefined;
  placeholder?: string | undefined;
  /* Ce qu'on saisit, pas comment le clavier se règle. Sans elle, React Native
     capitalise la première lettre : une adresse part en « Valentine@… » que le
     serveur refuse, et un pseudo en majuscule ne passe pas le contrat. */
  nature?: NatureDeChamp | undefined;
  invalid?: boolean | undefined;
  /* Ce qui a été VÉRIFIÉ, pas ce qui est simplement rempli. Un champ qu'on
     vient de confronter au serveur — un code de parrainage reconnu — doit se
     distinguer d'un champ qu'on n'a pas touché. */
  valide?: boolean | undefined;
  multiline?: boolean | undefined;
  autoFocus?: boolean | undefined;
  onChangeText?: ((texte: string) => void) | undefined;
  /* VALIDER AU CLAVIER, parce que le bouton n'est pas toujours atteignable.
     Sur un écran court, le clavier ouvert recouvre l'action principale : on
     tape son adresse et il faut refermer le clavier pour trouver le bouton.
     La touche de retour fait le geste sans ce détour. */
  onSubmitEditing?: (() => void) | undefined;
  /* Ce que dit la touche de retour. « send » sur un formulaire qui part,
     « next » quand un champ suit — un libellé faux promet le mauvais geste. */
  returnKeyType?: "done" | "go" | "next" | "send" | undefined;
}

export function TextField({
  label, hint, value, placeholder, nature = "texte",
  invalid = false, valide = false, multiline = false, autoFocus, onChangeText,
  onSubmitEditing, returnKeyType,
}: TextFieldProps) {
  const couleurs = useCouleurs();
  const s = styleDeChamp({ couleurs, invalide: invalid, valide, multiligne: multiline });
  const reglages = reglagesDeSaisie(nature);

  return (
    <View style={s.conteneur}>
      {label ? <Text style={s.etiquette}>{label}</Text> : null}
      <TextInput
        style={s.champ}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={s.couleurIndice}
        multiline={multiline}
        autoFocus={autoFocus}
        {...(returnKeyType ? { returnKeyType } : {})}
        {...(onSubmitEditing ? { onSubmitEditing } : {})}
        // Le nettoyage passe avant l'appelant : ce que les réglages du clavier
        // laissent encore entrer — collage, dictée, clavier tiers — se rattrape
        // à la frappe plutôt qu'à l'envoi.
        onChangeText={onChangeText ? (v) => onChangeText(nettoiePourLaNature(nature, v)) : undefined}
        accessibilityLabel={label}
        /* React Native n'a pas d'état « invalide » — ARIA en a un, lui pas. La
           faute doit donc vivre dans le texte d'aide, et c'est pour cela qu'il
           est à la fois annoncé et rougi : sans cela, l'erreur ne se voit que
           pour qui voit le contour. */
        accessibilityHint={hint}
        autoCapitalize={reglages.autoCapitalize}
        autoCorrect={reglages.autoCorrect}
        spellCheck={reglages.spellCheck}
        {...(reglages.keyboardType ? { keyboardType: reglages.keyboardType } : {})}
        {...(reglages.textContentType ? { textContentType: reglages.textContentType } : {})}
        {...(reglages.autoComplete ? { autoComplete: reglages.autoComplete } : {})}
        {...(reglages.maxLength ? { maxLength: reglages.maxLength } : {})}
      />
      {hint ? <Text style={s.aide}>{hint}</Text> : null}
    </View>
  );
}
