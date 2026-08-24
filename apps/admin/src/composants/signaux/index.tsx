// Ce que le back-office signale : un chiffre, une anomalie, une trace, un
// accusé. Quatre composants sans un mot à eux — les libellés arrivent en props,
// et tout ce qui est teinte, état et mise en page vit dans styles/signaux.css.
export { StatCard, type StatCardProps, type SensVariation } from "./StatCard.js";
export { AlertPill, type AlertPillProps, type TonAlerte } from "./AlertPill.js";
export { AuditTrail, type AuditTrailProps, type AuditEntree } from "./AuditTrail.js";
export { Toast, type ToastProps, type IntentToast } from "./Toast.js";
