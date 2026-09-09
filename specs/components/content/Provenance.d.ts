import * as React from "react";

export interface ProvenanceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** D'où vient l'élément : « noté », « dit par lui », « écrit à partir de 9 notes ». */
  origin?: string;
  /** Quand : « en mars », « le 12 août ». */
  date?: string;
}

export declare function Provenance(props: ProvenanceProps): React.ReactElement;
