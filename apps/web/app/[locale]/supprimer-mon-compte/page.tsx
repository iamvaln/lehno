import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AccountDeletionPage } from "../../../components/account-deletion/AccountDeletionPage.js";
import { messages } from "../../../messages/index.js";

// Requesting an account deletion — the French page.
//
// The path is in the language of the page, like the legal pages and for the
// same reason: a French word in the address bar of a reader who does not
// speak it, and a French page indexed under a foreign URL. The other
// language lives at `/en/delete-my-account`.
//
// Static, unlike the legal pages: the text is ours and does not come from the
// API, so there is nothing to fetch and nothing to revalidate.
type Proprietes = { params: Promise<{ locale: string }> };

export function generateStaticParams(): { locale: string }[] {
  return [{ locale: "fr" }];
}

// Anything but "fr" is a 404 rather than a page served under the wrong
// path — see generateStaticParams above.
export const dynamicParams = false;

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  const { locale } = await params;
  if (locale !== "fr") notFound();
  return <AccountDeletionPage t={messages("fr")} langue="fr" />;
}
