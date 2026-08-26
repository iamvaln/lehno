# Lehno — Ce qui a changé, côté back-office

À lire avec `brief-maj-contrat-commun.md`, qui porte les conventions partagées — statuts, erreurs par code, drapeaux. Ce document ne traite que l'outil d'administration.

Références : `ux-admin-lehno.md`, `spec-technique-lehno.md` (§8 pour les chemins, §9 pour les droits), `spec-portrait-lehno.md`, `design-system-lehno.md`.


> **Corrigé le 25/08/2026 — `ManualTopUp` n'existe plus.** Elle a été absorbée
> par `Payment`, distingué par son `mode` : `provider`, `semi_manual`, `manual`.
> Une entité séparée aurait obligé à tenir deux registres et deux historiques
> d'états, et **embrouillerait la comptabilité** — une recharge manuelle
> n'aurait même pas paru dans l'historique des paiements du client, alors que
> c'en est un du point de vue de celui qui a versé l'argent.
>
> Les chemins deviennent : `/admin/payments` (lecture et **saisie**),
> `/admin/payments/{id}/decision` (confirmer ou rejeter, avec la référence de
> la transaction et le montant constaté), et `/admin/collection-accounts` (les
> comptes sur lesquels les clients versent). Voir le dictionnaire, sections
> `Payment` et `CollectionAccount`.

---

## 1. La navigation s'allonge

Deux sections nouvelles dans la famille **Économie**, et la numérotation a bougé.

**Tableau de bord** *(entrée)*

**Exploitation** — comptes · crédits et paiements · modération
**Économie** — paramètres · **fonctionnalités** · modèles d'IA · **studio du portrait** · offres et croissance
**Supervision** — métriques · journal d'audit · connexions
**Outils** — liens externes

---

## 2. Le rôle `support` perd l'accès à toute la famille Économie

**Y compris en lecture.** Paramètres, fonctionnalités, modèles d'IA, studio, offres : fermés.

Et une règle qui va plus loin qu'un refus : **une section entièrement fermée ne figure pas dans le menu**. Le support ne voit pas des portes closes, il voit son outil.

Ce qui lui reste : comptes, crédits et paiements (consultation, relance d'opération), modération, tableau de bord, métriques, connexions, liens externes.

---

## 3. §5.7 Fonctionnalités — section nouvelle

Allumer et éteindre les fonctionnalités, pour livrer le produit par morceaux.

**Le registre vient du serveur.** `/admin/feature-flags` rend, pour chaque drapeau, ce qu'il gouverne **et la liste des écrans et points d'entrée qu'il couvre**. L'écran affiche cette couverture : un administrateur doit voir **ce qu'il éteint** avant de basculer, sans lire le code.

**Les conséquences s'annoncent avant la bascule.** Éteindre le Mur emporte le dépôt de vœux et la réservation ; éteindre mes listes emporte la réservation. L'écran le dit, plutôt que de le laisser découvrir.

**Le socle n'y figure pas** — proches, notes, dates, rappels, compte ne sont pas extinguibles.

Chaque bascule est journalisée avec son auteur et sa date.

---

## 4. §5.9 Studio du portrait — section nouvelle, en trois entrées

C'est la section la plus riche de l'outil, et celle qui bougera le plus.

**a) Réglages en service** — ce qui tourne aujourd'hui : modèle par production, orientations actives et leur ordre, ambiances, motif. Plus l'**historique des publications** (auteur, date, ce que chacune changeait) et le **retour arrière**, qui **republie** une version antérieure sans la reconstruire.

**b) Composition** — le brouillon : gabarits de production, consignes, garde-fous, libellés dans les deux langues, activation de chaque orientation et ambiance.

**c) Banc d'essai** — profils de simulation, essais, **comparaison de deux essais côte à côte** sur le même profil, coût du jour.

**Trois règles qui structurent l'écran**

- **Le brouillon et la publication sont deux choses.** On modifie librement ; rien ne change pour les utilisateurs tant qu'on n'a pas publié.
- **La publication se fait depuis le banc d'essai**, non depuis la composition : on publie après avoir vu un résultat, pas après avoir tapé un texte.
- **Elle est refusée tant qu'aucun essai n'a tourné** sur la combinaison en cours. L'écran doit rendre le bouton indisponible, pas laisser l'appel échouer.

**Le coût des essais s'affiche.** Chaque simulation appelle un modèle et se paie en argent réel — l'écran montre ce que l'essai a coûté et le cumul du jour, et un plafond quotidien évite qu'une après-midi de réglages passe inaperçue. Aucun crédit consommé, aucun compte réel touché.

**Les profils de simulation** se composent et se conservent depuis le banc d'essai. Ils doivent couvrir : fiche riche et fiche pauvre, nom court et nom long, les deux langues, relation familiale et professionnelle, et **au moins un cas sensible** — c'est celui qui révèle si un gabarit dérape.

---

## 5. §5.4 Crédits et paiements — trois ajouts

**Les paliers d'achat.** Montants, crédits obtenus, remise affichée, ordre. Aucune saisie libre côté application : le plus petit palier fixe le minimum.

**Les recharges manuelles.** Une file de demandes à traiter, avec le justificatif déposé.

> **Le justificatif ne prouve rien.** Un montage est facile : l'administrateur **vérifie la réception sur le compte de l'opérateur** avant d'approuver. L'écran doit porter ce rappel — il évite l'approbation machinale. Rejeter exige un motif ; le fichier s'efface une fois la demande traitée.

**La confirmation manuelle d'un paiement.** Une opération restée en attente alors qu'elle a visiblement abouti chez l'opérateur se tranche à la main, avec motif.

**L'historique d'un paiement** s'affiche dans son détail : chaque état avec sa **durée**, ce qui l'a provoqué (geste de l'utilisateur, notification, interrogation, décision d'administration, traitement programmé) et son auteur.

---

## 6. §5.8 Modèles d'IA — le facturé et le réel

L'écran montre désormais, en face l'un de l'autre, **ce qu'une production a coûté** et **ce qu'elle a rapporté**.

Le prix étant unique pour tous, certaines productions coûtent plus qu'elles ne rapportent et d'autres moins : **c'est la moyenne qui compte**.

Et le point le plus facile à oublier : **les opérations d'administration ne facturent rien mais coûtent** — essais du studio, régénérations offertes, classement des notes, détection du sensible. Les omettre donnerait une marge flatteuse et fausse. `AIUsage.origin` permet de les distinguer.

---

## 7. §5.2 Tableau de bord — une ligne de plus

**Ressources** : l'espace occupé sur le stockage de fichiers et sa progression, rapportés au plafond du plan. L'alerte se déclenche à **70 %**, pas quand le plafond est atteint.

---

## 8. Ce que le back-office doit respecter, comme le reste

**Deux thèmes.** L'outil suit le thème du système et laisse l'imposer. Les séances sont longues ; le choix appartient à celui qui l'utilise. Les couleurs se déclarent **par rôle**, jamais par valeur.

**Bilingue.** L'interface suit la langue de l'administrateur. `admin/Topbar.jsx`, `admin/Breadcrumb.jsx` et `admin/AuditTrail.jsx` écrivent encore des chaînes en dur — même règle que pour l'application : **aucune chaîne dans un composant**.

**Motif obligatoire.** Les appels qui modifient l'état d'un compte, un solde ou un contenu **exigent un motif**. Sans lui la requête échoue — c'est ce qui garantit que le journal d'audit dise quelque chose.

**Une action hors des droits n'apparaît pas.** L'interface n'expose que ce que le rôle permet ; le serveur refuse par ailleurs.

**Le journal d'audit est réservé aux administrateurs** — c'est ce qui lui donne sa valeur de contrôle sur le travail du support.

---

## 9. Les chemins

Les nouveaux, sous `/v1/admin` :

| Chemin | Rôle |
|---|---|
| `/admin/feature-flags` | Drapeaux et leur couverture |
| `/admin/credit-bundles` | Paliers d'achat |
| `/admin/manual-topups`, `/{id}/decision` | Recharges manuelles à traiter |
| `/admin/payments/{id}/confirm` | Confirmation manuelle d'un paiement |
| `/admin/portrait-studio/candidates` | Valeurs candidates |
| `/admin/portrait-studio/config`, `/publish`, `/rollback`, `/history` | Brouillon, publication, retour arrière |
| `/admin/portrait-studio/profiles` | Profils de simulation |
| `/admin/portrait-studio/trials` | Essais |
| `/admin/portrait-studio/templates`, `/{id}` | Gabarits et leurs versions |

**Tous réservés au rôle `admin`.**

---

## 10. Ce qui reste ouvert

- Les **schémas détaillés** de requête et de réponse.
- Le **plafond quotidien** des essais du studio.
- Les **libellés** des drapeaux dans les deux langues — ils viennent du registre, côté serveur.
