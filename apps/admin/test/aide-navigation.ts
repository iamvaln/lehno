import { screen, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import { messages } from "../src/i18n/index.js";
import { NAVIGATION } from "../src/navigation.js";

const t = messages("fr");

/**
 * L'intitulé de section qui porte chaque écran, DÉRIVÉ de la navigation.
 *
 * Écrit à la main, il oubliait la deuxième section le jour où elle est
 * apparue — et le test tombait sur « introuvable » pour une raison qui n'avait
 * rien à voir avec ce qu'il éprouvait. Ici, ajouter une section au menu suffit.
 */
const PARENTS = new Map<string, string>(
  NAVIGATION.flatMap(({ items }) =>
    items.flatMap((item) => (typeof item === "string"
      ? []
      : item.enfants.map((enfant) => [enfant, item.id] as [string, string]))),
  ),
);

/**
 * Aller à une section comme un humain le ferait : ouvrir sa section si elle est
 * repliée, puis choisir dedans.
 *
 * **On ouvre, on ne bascule pas.** L'intitulé est un interrupteur : le cliquer
 * alors que la section est déjà ouverte la referme, et le deuxième écran d'une
 * même section devient introuvable.
 */
export async function allerA(
  utilisateur: ReturnType<typeof userEvent.setup>,
  section: string,
): Promise<void> {
  // Le fil d'Ariane est lui aussi une région de navigation : on vise la
  // première, celle de la barre latérale.
  const nav = screen.getAllByRole("navigation")[0] as HTMLElement;
  const libelles = t.sections as unknown as Record<string, string>;

  const parent = PARENTS.get(section);
  if (parent && !within(nav).queryByText(libelles[section] as string)) {
    const intitule = within(nav).queryByText(libelles[parent] as string);
    if (intitule) await utilisateur.click(intitule);
  }
  await utilisateur.click(within(nav).getByText(libelles[section] as string));
}
