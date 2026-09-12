# Traçabilité des clients — le web (et l'admin)

*12 septembre 2026. Détaille `plan-tracabilite-des-clients-2026-09-12.md`.
À lire avec la spec backend, qui décide des noms d'en-têtes et des refus.*

---

## 1. Le web n'est pas UN client, il en est DEUX

C'est le point qui distingue cette spec de celle du mobile, et il a été trouvé en
lisant le code plutôt qu'en le supposant.

| voie | qui appelle | ce que l'utilisateur peut lire |
| --- | --- | --- |
| **serveur** | les composants Next, en rendu — `lib/config-publique.ts`, `lib/legal.ts`, `lib/surface-publique.ts` | **rien** : la clé reste dans l'environnement du serveur Next |
| **navigateur** | les composants `"use client"` — `FormulaireAttente`, `ContactForm`, `CarteSouhait` | **tout** : ce qui part au navigateur est dans le paquet |

**Conséquence, et elle décide de la suite** : sur la voie serveur, la clé est un
**vrai secret**. C'est le seul endroit de tout le produit où elle en est un — le
mobile la livre dans son binaire, le navigateur dans son paquet.

### Une paire ou deux ?

**Proposé : deux.** `web_server` et `web_browser`, chacun son couple.

Les mêler reviendrait à traiter la clé serveur comme publique, puisqu'elle
partirait dans le paquet du navigateur — et on perdrait le seul endroit où elle
protège vraiment quelque chose. Deux paires coûtent une ligne de configuration de
plus et gardent la distinction.

Et ça se lit ensuite dans les chiffres : « combien d'appels viennent du rendu,
combien du navigateur » est une question qu'on se posera au premier pic de
trafic.

---

## 2. Les en-têtes

```
X-Client-Id      constante du build
X-Client-Key     constante du build
X-Client-Type    WEB
X-App-Version    la version du paquet — 0.3.1
X-App-OS         web:<navigateur>   ← voir §4
X-App-Env        prod | staging | dev
```

### Voie serveur

Les trois fichiers qui appellent (`config-publique`, `legal`,
`surface-publique`, plus ce qui s'ajoutera) passent tous par `fetch` avec une
base commune. **Le travail est de leur donner un point de passage unique**, comme
`lib/api.ts` côté mobile — aujourd'hui chacun construit son appel, et un
quatrième fichier oublierait les en-têtes sans que rien ne tombe.

C'est le vrai contenu de ce lot côté web : **une fonction d'appel, une seule**.

### Voie navigateur

Trois composants appellent `/v1/public/*` à la main. Même remède : un point de
passage, et les en-têtes dedans.

**Les valeurs doivent être exposées au navigateur** — préfixe `NEXT_PUBLIC_`. Ce
préfixe dit exactement ce qu'il fait, et il faut l'assumer : ce qui le porte est
public.

---

## 3. Ce que le serveur exige, et ce qu'il n'exige pas

**Tous ces appels visent `/v1/public/*`**, qui est **hors garde** (spec backend
§3) : un lien de liste s'ouvre dans le navigateur de quelqu'un qui n'a rien
installé, et y poser la garde fermerait le partage.

**Les en-têtes s'envoient quand même**, et ce n'est pas contradictoire : hors
garde veut dire « on ne refuse pas », pas « on ne compte pas ». C'est ainsi qu'on
saura combien d'ouvertures de liens viennent de notre site plutôt que d'un
aperçu de messagerie ou d'un robot.

**Il n'y a donc rien à gérer côté erreurs sur cette voie** : aucun 403 possible.
Si un jour le web appelle une surface sous garde, la règle du mobile s'applique —
écran d'arrêt, jamais de réessai.

---

## 4. `X-App-OS` sur le web

Le format `<os>:<version>` ne veut pas dire grand-chose dans un navigateur.

**Proposé** : `web:<nom du navigateur>` déduit de l'agent utilisateur —
`web:chrome`, `web:safari`. Sans version : elle change toutes les six semaines,
et personne n'a l'usage de cette précision-là.

**Sur la voie serveur, il n'y a pas de navigateur du tout.** Proposé : `web:ssr`,
qui dit ce que c'est plutôt que de laisser un champ vide qu'on lirait comme un
oubli.

---

## 5. L'admin est un TROISIÈME client, et il n'était pas dans la demande

`apps/admin/src/api/client.ts` — une application Vite, entièrement dans le
navigateur, qui parle à `/v1/admin/*`.

Elle mérite sa paire pour la même raison que les autres : savoir quelle version
du panneau a passé un geste d'administration vaut au moins autant que de le
savoir pour l'application grand public. C'est même plus vrai — ces gestes-là
changent des réglages en production.

**Proposé** : `admin_browser`, même traitement, et `X-Client-Type: WEB`.

Ce n'est pas dans votre demande initiale. Je le signale plutôt que de l'ajouter
en silence, ou de l'omettre parce qu'il n'y était pas.

---

## 6. Ce qu'il y a à éprouver

- Chaque voie d'appel passe par le point unique — un appel écrit à la main à côté
  doit se voir. **C'est le cas qui compte** : l'oubli d'un en-tête sur une voie
  ne fait rien tomber, il rend juste le journal incomplet.
- La voie serveur n'expose **jamais** sa clé au navigateur : aucune valeur
  `NEXT_PUBLIC_` ne porte la clé serveur. Un cas qui inspecte la configuration
  vaut mieux qu'une relecture attentive.
- `X-App-Env` vaut bien ce que l'environnement dit, et non une valeur figée.

---

## 7. À trancher avant d'écrire

1. **Deux paires web, ou une ?** (§1) J'incline nettement vers deux.
2. **L'admin en fait-il partie ?** (§5)
3. **`web:<navigateur>` sans version** (§4) — ou faut-il la version ?
4. **La version du paquet web** : `package.json` porte `0.1.0` comme le mobile.
   Est-ce qu'on la fait vivre, ou est-ce qu'on envoie plutôt le SHA du commit
   déployé ? Pour un site qui se déploie en continu, **le SHA dit plus** — il n'y
   a pas de « version » que quelqu'un installerait.
