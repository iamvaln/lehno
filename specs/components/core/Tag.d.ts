import * as React from "react";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  /** outline — étiquette de goût. quiet — décompte, état. celebrate — « aujourd'hui ». */
  tone?: "outline" | "quiet" | "celebrate";
}

export declare function Tag(props: TagProps): React.ReactElement;
