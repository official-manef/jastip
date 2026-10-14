/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * TITIPIN uses its own email/password accounts. The enabled flag also turns
 * off the broker OAuth and gate identity plugins in the auth server.
 */
export const emailAndPasswordEnabled = true;
