Champ de saisie — texte sur une ligne ou zone de texte.

```jsx
<TextField label="Votre adresse e-mail" type="email" placeholder="vous@exemple.fr" />
<TextField multiline rows={5} label="Une note sur Valery" />
```

**Ajout intentionnel** : la charte ne traite pas encore les formulaires. À revoir quand elle le fera. En mobile, `platform="mobile"` garde 16 px de texte — en dessous, iOS zoome au focus.
