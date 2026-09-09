Les logos des réseaux sociaux — les vraies marques, posées en masque pour prendre la
couleur du texte.

```jsx
<SocialGlyph reseau="instagram" size={17} color="var(--text-secondary)" base="../../" />
```

`reseau` : `instagram` · `tiktok` · `x` · `linkedin` · `facebook` · `youtube`.
Les fichiers vivent dans `assets/social/`, en 24 × 24 à un seul chemin.

**Ce sont des marques déposées.** On les emploie pour désigner un compte : jamais
recolorées dans leur teinte propre, jamais déformées, jamais mêlées à la pastille
Lehno dans un verrouillage. Sous 16 px, le glyphe TikTok et le X deviennent illisibles
— rester au palier 17 px du système.

**Pourquoi un masque plutôt qu'une `<img>`** : la règle du système veut qu'une icône
prenne la couleur du texte qu'elle accompagne. Une image ne le permet pas, et un SVG
noir en dur disparaît sur le thème sombre.
