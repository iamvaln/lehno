import { invitationSchema, type Invitation } from "@lehno/contracts";
import { chargerSurface, type Etat } from "./surface-publique.js";

export type EtatInvitation = Etat<Invitation>;

/* Un code inconnu, expiré ou déjà employé rend tous les trois 404 : le contrat
   ne porte pas la raison, et la page ne l'invente pas — dire « expiré » d'un
   code jamais émis apprendrait qu'un code a un jour été valide. */
export function chargerInvitation(code: string, revalidate: number): Promise<EtatInvitation> {
  return chargerSurface(
    `/public/invitations/${encodeURIComponent(code)}`,
    invitationSchema,
    revalidate,
  );
}
