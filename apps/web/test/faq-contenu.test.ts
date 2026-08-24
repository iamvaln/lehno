import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { messages } from "../messages/index.js";

// Le contenu de la FAQ est entièrement rédigé dans le paquet de passation
// (design_handoff_surfaces_publiques/ui_kits/web/pages.html, clé "faq" du
// dictionnaire fr/en) : quinze questions par langue, groupées par thème. Ce
// test recopie ce texte tel quel — aucune reformulation, aucun résumé,
// aucune traduction improvisée — pour prouver que ce qui est publié est bien
// ce qui a été rédigé, pas une paraphrase qui dérive au premier commit venu.
// Deux réponses par langue restent des décisions à prendre (expiration des
// crédits, accès aux contacts/agenda) : elles portent "couvre" au lieu de
// "reponse", et gardent leur bloc « à rédiger » côté rendu.

const GROUPES_FR = [
  {
    titre: "Commencer",
    items: [
      { q: "Faut-il payer pour utiliser Lehno ?", reponse: "Non. Retenir les dates, écrire des notes et recevoir les rappels ne coûte rien. Seules les créations — un message, un portrait, une idée de cadeau — coûtent un crédit." },
      { q: "Sur quels téléphones l'application fonctionne-t-elle ?", reponse: "iOS et Android. Les versions minimales sont indiquées sur l'App Store et sur Google Play." },
      { q: "Combien de temps faut-il pour s'y mettre ?", reponse: "Une date et un prénom suffisent. Les fiches se remplissent au fil de l'année, pas le jour de l'inscription." },
    ],
  },
  {
    titre: "Les crédits",
    items: [
      { q: "Combien coûte un crédit ?", reponse: "100 F le crédit, et 5 crédits offerts à l'inscription. Un crédit par contenu créé pour vous : le portrait, les idées de cadeau, le message." },
      { q: "Les crédits expirent-ils ?", reponse: "Non, ils ne périment pas : ils restent acquis tant que le compte existe. Vous les dépensez au rythme qui vous convient." },
      { q: "Comment payer sans carte bancaire ?", reponse: "Par mobile money, MTN ou Orange. La validation prend parfois quelques minutes : l'écran suit l'opération jusqu'au bout." },
      { q: "Que se passe-t-il si une création échoue ?", reponse: "Le crédit revient sur votre solde, et l'application vous dit ce qui s'est passé." },
    ],
  },
  {
    titre: "Les proches et les notes",
    items: [
      { q: "Mes proches savent-ils que j'écris sur eux ?", reponse: "Non. Vos notes ne sont visibles que de vous, et ne servent qu'à ce que vous demandez." },
      { q: "Qu'est-ce que je peux noter ?", reponse: "Tout ce qui aide à bien faire : des goûts, des envies entendues, un détail qui vous a marqué. Rien que vous ne diriez pas à la personne." },
      { q: "Est-ce que l'application lit mes contacts ou mon agenda ?", reponse: "Non. Elle ne demande ni vos contacts ni votre agenda : les dates que vous suivez, c'est vous qui les saisissez." },
    ],
  },
  {
    titre: "Le Mur",
    items: [
      { q: "Qui peut voir mon Mur ?", reponse: "Toute personne qui a le lien. C'est une page publique, et elle se dépublie à tout moment depuis l'application." },
      { q: "Puis-je choisir ce qui apparaît dessus ?", reponse: "Oui, élément par élément. Vos notes sur vos proches n'y figurent jamais." },
      { q: "Comment signaler un Mur ?", reponse: "Chaque Mur porte un lien de signalement en pied de page. Ce qui est signalé est examiné, et retiré s'il doit l'être." },
    ],
  },
  {
    titre: "Le compte",
    items: [
      { q: "Comment me connecter sans mot de passe ?", reponse: "Un code arrive sur votre adresse e-mail. Vous pouvez aussi entrer par Google ou par Apple — c'est le même compte." },
      { q: "Comment supprimer mon compte ?", reponse: "Depuis Moi, puis Compte et sécurité. La page « Supprimer votre compte » dit ce qui disparaît et ce qui est conservé." },
    ],
  },
];

const GROUPES_EN = [
  {
    titre: "Getting started",
    items: [
      { q: "Do I have to pay to use Lehno?", reponse: "No. Holding dates, writing notes and getting reminders costs nothing. Only creations — a message, a portrait, a gift idea — cost a credit." },
      { q: "Which phones does the app run on?", reponse: "iOS and Android. Minimum versions are listed on the App Store and on Google Play." },
      { q: "How long does setting up take?", reponse: "One date and a first name is enough. Profiles fill up over the year, not on the day you sign up." },
    ],
  },
  {
    titre: "Credits",
    items: [
      { q: "How much is a credit?", reponse: "100 F per credit, and 5 credits when you sign up. One credit per piece written for you: the portrait, the gift ideas, the message." },
      { q: "Do credits expire?", reponse: "No, they do not expire: they stay yours for as long as the account exists. You spend them at your own pace." },
      { q: "Can I pay without a bank card?", reponse: "With mobile money, MTN or Orange. Confirmation sometimes takes a few minutes: the screen follows the payment through." },
      { q: "What if a creation fails?", reponse: "The credit comes back to your balance, and the app tells you what happened." },
    ],
  },
  {
    titre: "People and notes",
    items: [
      { q: "Do the people I write about know?", reponse: "No. Your notes are visible only to you, and serve only what you ask for." },
      { q: "What should I write down?", reponse: "Anything that helps you do well: tastes, wishes overheard, a detail that stayed with you. Nothing you wouldn't say to them." },
      { q: "Does the app read my contacts or calendar?", reponse: "No. It asks for neither your contacts nor your calendar: the dates you follow are the ones you enter yourself." },
    ],
  },
  {
    titre: "The Wall",
    items: [
      { q: "Who can see my Wall?", reponse: "Anyone with the link. It's a public page, and it can be unpublished at any time from the app." },
      { q: "Can I choose what appears on it?", reponse: "Yes, item by item. Your notes about other people never appear there." },
      { q: "How do I report a Wall?", reponse: "Every Wall carries a report link in its footer. What gets reported is reviewed, and taken down if it should be." },
    ],
  },
  {
    titre: "Your account",
    items: [
      { q: "How do I sign in without a password?", reponse: "A code arrives at your email address. You can also come in through Google or Apple — it's the same account." },
      { q: "How do I delete my account?", reponse: "From Me, then Account and security. The \"Delete your account\" page says what disappears and what is kept." },
    ],
  },
];

describe("contenu de la FAQ", () => {
  it("porte les cinq groupes et les quinze questions françaises, mot pour mot", () => {
    const t = messages("fr");
    expect(t.faq.groupes).toEqual(GROUPES_FR);
  });

  it("porte les cinq groupes et les quinze questions anglaises, mot pour mot", () => {
    const t = messages("en");
    expect(t.faq.groupes).toEqual(GROUPES_EN);
  });

  it("compte exactement quinze questions par langue", () => {
    for (const langue of ["fr", "en"] as const) {
      const total = messages(langue).faq.groupes.reduce((n, g) => n + g.items.length, 0);
      expect(total).toBe(15);
    }
  });

  // Les quatre questions citées dans la commande, prises au hasard dans les
  // groupes : elles doivent s'y trouver telles quelles.
  it("contient les questions repères citées dans la commande", () => {
    const fr = messages("fr").faq.groupes.flatMap((g) => g.items.map((i) => i.q));
    for (const q of [
      "Faut-il payer pour utiliser Lehno ?",
      "Mes proches savent-ils que j'écris sur eux ?",
      "Qui peut voir mon Mur ?",
      "Comment supprimer mon compte ?",
    ]) {
      expect(fr).toContain(q);
    }
  });

  // Ce test gardait l'inverse : deux réponses restaient en attente d'une
  // décision — l'expiration des crédits et l'accès aux contacts. Les deux ont
  // été tranchées le 24/08/2026, et le bloc « à rédiger » a été retiré avec
  // elles. L'invariant qui compte désormais : aucune question sans réponse.
  //
  // Une question posée sans réponse est pire qu'une question absente : elle
  // promet et ne tient pas.
  it("ne laisse aucune question sans réponse", () => {
    for (const langue of ["fr", "en"] as const) {
      const items = messages(langue).faq.groupes.flatMap((g) => g.items);
      const muettes = items.filter((i) => !("reponse" in i) || !i.reponse.trim());
      expect(muettes.map((i) => i.q), `questions sans réponse en ${langue}`).toEqual([]);
    }
  });

  // La réponse sur les crédits doit dire la même chose que les conditions
  // d'utilisation, dans les mêmes mots — c'est ce que la note en attente
  // exigeait, et c'est la seule raison pour laquelle elle attendait.
  it("dit sur les crédits ce que disent les conditions d'utilisation", () => {
    const cgu = readFileSync(
      join(import.meta.dirname, "..", "..", "api", "src", "public", "legal", "cgu.fr.md"),
      "utf-8",
    );
    const item = messages("fr").faq.groupes
      .flatMap((g) => g.items)
      .find((i) => i.q.includes("expirent"))!;

    expect(item.reponse).toContain("ne périment pas");
    expect(cgu, "les conditions doivent porter les mêmes mots").toContain("ne périment pas");
    expect(item.reponse).toContain("tant que le compte existe");
    expect(cgu).toContain("tant que le compte existe");
  });
});
