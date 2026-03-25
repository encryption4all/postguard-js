import type { Recipient, PolicyEntry } from '../types.js';

function extractDomain(email: string): string {
  return email.split('@')[1] || '';
}

/** Build an encryption policy map from a list of recipients */
export function buildEncryptionPolicy(
  recipients: Recipient[],
  timestamp: number
): Record<string, PolicyEntry> {
  const policy: Record<string, PolicyEntry> = {};

  for (const r of recipients) {
    switch (r.type) {
      case 'email':
        policy[r.email] = {
          ts: timestamp,
          con: [{ t: 'pbdf.sidn-pbdf.email.email', v: r.email }],
        };
        break;
      case 'emailDomain':
        policy[r.email] = {
          ts: timestamp,
          con: [{ t: 'pbdf.sidn-pbdf.email.domain', v: extractDomain(r.email) }],
        };
        break;
    }
  }

  return policy;
}
