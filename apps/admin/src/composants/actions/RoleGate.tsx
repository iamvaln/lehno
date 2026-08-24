import type { ReactNode } from "react";
import type { AdminRole } from "@lehno/contracts";

export interface RoleGateProps {
  role: AdminRole;
  /** Rôle ou rôles autorisés à voir ce que le composant enveloppe. */
  autorise: AdminRole | AdminRole[];
  children: ReactNode;
}

/** « L'interface n'expose que les actions permises par le rôle » (§6).
 *
 *  On **retire**, on ne grise pas : un bouton désactivé promet une permission
 *  qu'on n'a pas, invite à la demander, et fait de chaque écran une négociation.
 *  Rien n'est rendu — pas même un conteneur vide, qui laisserait une trace dans
 *  la mise en page et dans le DOM. Chacun voit exactement ce qu'il peut faire. */
export function RoleGate({ role, autorise, children }: RoleGateProps) {
  const permis = Array.isArray(autorise) ? autorise : [autorise];
  if (!permis.includes(role)) return null;
  return <>{children}</>;
}
