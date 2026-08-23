import type { Locale } from "@lehno/i18n";

export type Mail = { to: string; subject: string; text: string; locale: Locale };

// Une interface, pour que changer de service ne demande qu'un adaptateur.
export interface MailPort { send(mail: Mail): Promise<void>; }
