import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { IdentityVerifier } from "./federated.service.js";

// Vérificateurs réels des deux fournisseurs. Non testés par réseau — voir
// test/federated.test.ts, qui les remplace par un IdentityVerifier de test.

export class GoogleIdentityVerifier implements IdentityVerifier {
  private readonly client: OAuth2Client;

  // Construit toujours sans erreur, même clientId vide : la route
  // /auth/federated est isolée du reste, à la différence d'OTP_PEPPER/
  // JWT_SECRET qui servent à chaque requête. On refuse seulement à l'usage,
  // pour ne pas empêcher le module entier de démarrer faute d'identifiant
  // client configuré.
  constructor(private readonly clientId: string) {
    this.client = new OAuth2Client(clientId || undefined);
  }

  async verify(idToken: string): ReturnType<IdentityVerifier["verify"]> {
    if (!this.clientId) throw new Error("GOOGLE_CLIENT_ID manquant");
    const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new Error("google token missing subject");
    return {
      providerUserId: payload.sub,
      email: payload.email ?? null,
      emailVerified: payload.email_verified ?? false,
    };
  }
}

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

export class AppleIdentityVerifier implements IdentityVerifier {
  // createRemoteJWKSet met les clés publiques en cache et les rafraîchit
  // seule : un même vérificateur sert tout le cycle de vie du process.
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  // Même logique que GoogleIdentityVerifier : construction toujours possible,
  // refus repoussé à l'usage.
  constructor(private readonly clientId: string) {
    this.jwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  }

  async verify(idToken: string): ReturnType<IdentityVerifier["verify"]> {
    if (!this.clientId) throw new Error("APPLE_CLIENT_ID manquant");
    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer: APPLE_ISSUER,
      audience: this.clientId,
    });
    if (!payload.sub) throw new Error("apple token missing subject");
    const email = typeof payload["email"] === "string" ? payload["email"] : null;
    const emailVerified = payload["email_verified"] === true || payload["email_verified"] === "true";
    return { providerUserId: payload.sub, email, emailVerified };
  }
}
