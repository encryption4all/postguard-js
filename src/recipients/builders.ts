import type { Recipient, PolicyEntry } from '../types.js';

function extractDomain(email: string): string {
  return email.split('@')[1] || '';
}

/** Build the full attribute constraint list for a recipient. */
function buildCon(r: Recipient): { t: string; v: string }[] {
  const base =
    r._baseType === 'email'
      ? [{ t: 'pbdf.sidn-pbdf.email.email', v: r.email }]
      : [{ t: 'pbdf.sidn-pbdf.email.domain', v: extractDomain(r.email) }];

  return [...base, ...r._extras];
}

/** Build an encryption policy map from a list of recipients */
export function buildEncryptionPolicy(
  recipients: Recipient[],
  timestamp: number
): Record<string, PolicyEntry> {
  const policy: Record<string, PolicyEntry> = {};

  for (const r of recipients) {
    policy[r.email] = {
      ts: timestamp,
      con: buildCon(r),
    };
  }

  return policy;
}
