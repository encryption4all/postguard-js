/**
 * Decode the payload of a JWT **without** verifying its signature.
 *
 * SECURITY: this performs NO cryptographic verification, so the returned
 * claims are not trustworthy on their own. The PKG server remains the source
 * of truth — it verifies the JWT signature before issuing any key. Callers
 * therefore MUST NOT make a trust decision based solely on these claims.
 * Instead they must bound the claim's effect (e.g. clamp a claimed `exp`)
 * and/or cross-check it against a locally-known source of truth (e.g. the
 * attribute set the client itself requested).
 *
 * The token is validated structurally: it must have exactly three non-empty
 * dot-separated segments and a base64url payload that JSON-decodes to an
 * object. Anything else returns `null` rather than throwing.
 *
 * @returns the decoded payload object, or `null` if the token is malformed.
 */
export function decodeJwtPayloadUnsafe(jwt: unknown): Record<string, unknown> | null {
  if (typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  // A well-formed JWS has header.payload.signature — three non-empty segments.
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;

  try {
    const json = base64UrlDecode(parts[1]);
    const decoded = JSON.parse(json);
    if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
      return null;
    }
    return decoded as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Decode a base64url string to a UTF-8 string. */
function base64UrlDecode(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  // atob yields a binary (latin1) string; re-decode as UTF-8 so multibyte
  // characters in claims (e.g. accented names, non-ASCII emails) survive.
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
