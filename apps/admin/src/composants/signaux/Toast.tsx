import { useEffect, type ReactNode } from "react";
import { Icon } from "../base/Icon.js";

/** success — l'action a eu lieu · info — un fait · error — elle a échoué. */
export type IntentToast = "success" | "info" | "error";

export interface ToastProps {
  children: ReactNode;
  intent?: IntentToast;
  /** Sortie offerte par l'accusé : « Annuler », « Voir le compte ». */
  action?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  /** Nom accessible de la croix. Sans lui, l'accusé n'a pas de croix : un bouton
   *  sans nom ne s'annonce pas, et le toast s'efface de toute façon seul. */
  libelleFermer?: string;
  /** Millisecondes avant effacement. 0 le fige. */
  duree?: number;
}

const ICONES: Record<IntentToast, string> = {
  success: "circle-check",
  info: "info",
  error: "circle-x",
};

/** Accusé d'un geste parti d'une liste, d'une ligne ou d'un dialogue : il
 *  apparaît en bas, laisse une sortie, et **s'efface seul**.
 *
 *  Une erreur bloquante n'est jamais un toast : elle reste sous les yeux, en
 *  bannière. `intent="error"` n'accuse qu'un geste qui a échoué — un toast ne
 *  se lit pas deux fois. */
export function Toast({ children, intent = "success", action, onAction, onDismiss, libelleFermer, duree = 6000 }: ToastProps) {
  useEffect(() => {
    if (!onDismiss || !duree) return;
    const minuterie = setTimeout(onDismiss, duree);
    return () => clearTimeout(minuterie);
  }, [onDismiss, duree, children]);

  return (
    <div className="admin-toast" data-intent={intent} role={intent === "error" ? "alert" : "status"} aria-live="polite">
      <Icon name={ICONES[intent]} size={17} className="admin-toast-icone" />
      <span className="admin-toast-texte">{children}</span>
      {action ? (
        <button type="button" className="admin-toast-action admin-focus" onClick={onAction}>{action}</button>
      ) : null}
      {onDismiss && libelleFermer ? (
        <button type="button" className="admin-toast-fermer admin-focus" aria-label={libelleFermer} onClick={onDismiss}>
          <Icon name="x" size={15} />
        </button>
      ) : null}
    </div>
  );
}
