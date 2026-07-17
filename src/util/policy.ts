/** Sort policy attributes alphabetically by type */
export function sortPolicies(con: { t: string; v?: string }[]): { t: string; v?: string }[] {
  return [...con].sort((a, b) => a.t.localeCompare(b.t));
}

/** Current Unix time in whole seconds.
 *
 * Uses `floor`, never `round`: this stamps the policy timestamp a sealed
 * container is keyed on, and the PKG rejects a USK request whose timestamp is
 * in the future ("chronology error"). `Math.round` can land up to ~1s ahead of
 * the real time, so an immediate decrypt (encrypt→decrypt within the same
 * second) could fail; `floor` is always ≤ now. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Calculate seconds until 4 AM (PKG key validity period) */
export function secondsTill4AM(): number {
  const now = Date.now();
  const nextMidnight = new Date(now).setHours(24, 0, 0, 0);
  const secondsTillMidnight = Math.round((nextMidnight - now) / 1000);
  return (secondsTillMidnight + 4 * 60 * 60) % (24 * 60 * 60);
}

import { DEFAULT_EMAIL_ATTRIBUTES, type EmailAttributes } from './attributes.js';

/** Build the key request from a policy entry for a specific recipient */
export function buildKeyRequest(
  key: string,
  policy: { ts: number; con: { t: string; v?: string }[] },
  attrs: EmailAttributes = DEFAULT_EMAIL_ATTRIBUTES
): { con: { t: string; v?: string }[]; validity: number } {
  const recipientAndCreds = sortPolicies(policy.con);

  const stripped = JSON.parse(JSON.stringify(recipientAndCreds));
  for (const c of stripped) {
    if (c.t === attrs.email) {
      c.v = key;
    } else if (c.t === attrs.domain) {
      if (!c.v && key.includes('@')) {
        c.v = key.split('@')[1];
      }
    } else {
      delete c.v;
    }
  }

  return {
    con: stripped,
    validity: secondsTill4AM(),
  };
}
