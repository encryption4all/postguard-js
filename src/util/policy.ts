/** Sort policy attributes alphabetically by type */
export function sortPolicies(con: { t: string; v?: string }[]): { t: string; v?: string }[] {
  return [...con].sort((a, b) => a.t.localeCompare(b.t));
}

/** Calculate seconds until 4 AM (PKG key validity period) */
export function secondsTill4AM(): number {
  const now = Date.now();
  const nextMidnight = new Date(now).setHours(24, 0, 0, 0);
  const secondsTillMidnight = Math.round((nextMidnight - now) / 1000);
  return (secondsTillMidnight + 4 * 60 * 60) % (24 * 60 * 60);
}

/** Build the key request from a policy entry for a specific recipient */
export function buildKeyRequest(
  key: string,
  policy: { ts: number; con: { t: string; v?: string }[] }
): { con: { t: string; v?: string }[]; validity: number } {
  const recipientAndCreds = sortPolicies(policy.con);

  const stripped = JSON.parse(JSON.stringify(recipientAndCreds));
  for (const c of stripped) {
    if (c.t === 'pbdf.sidn-pbdf.email.email') {
      c.v = key;
    } else if (c.t === 'pbdf.sidn-pbdf.email.domain') {
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
