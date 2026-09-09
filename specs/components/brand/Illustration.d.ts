import * as React from "react";

export type NomIllustration =
  /* Les états vides de l'application */
  | "carnet-neuf" | "rien-approche" | "annuaire-vide" | "calendrier-sans-date"
  | "contributions-aucune" | "note-aucune" | "souhaits-vide" | "portrait-aucun"
  | "mur-aucun-mot" | "recherche-sans-resultat"
  /* Les attentes et les issues */
  | "generation-en-cours" | "paiement-attente" | "paiement-abouti"
  | "paiement-echoue" | "credits-epuises"
  /* L'entrée dans l'application */
  | "bienvenue-credits" | "verification-code"
  /* Les surfaces publiques */
  | "lien-revoque" | "voeux-clos" | "page-introuvable" | "mur-depublie"
  | "contribution-envoyee" | "souhait-reserve"
  /* Le back-office */
  | "bo-file-vide" | "bo-aucun-resultat";

/**
 * Les illustrations du produit — états vides, attentes, issues, surfaces publiques. Formes pleines en aplats, sans contour,
 * silhouettes sans visage ni traits. Elles ne décorent pas l'application :
 * elles occupent la place que le contenu n'occupe pas encore.
 * @startingPoint section="Brand" subtitle="Les vingt-cinq illustrations, deux thèmes" viewport="900x620"
 */
export interface IllustrationProps extends React.SVGAttributes<SVGSVGElement> {
  nom: NomIllustration;
  /** Largeur en px. Le brief les valide à 120 px ; 160 est le confort mobile. */
  largeur?: number;
}

export declare function Illustration(props: IllustrationProps): React.ReactElement | null;

/** La source des tracés — un tableau [tag, attributs] par forme. */
export declare const ILLUSTRATIONS: Record<NomIllustration, Array<[string, Record<string, unknown>]>>;
