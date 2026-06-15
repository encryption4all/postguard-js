import { PG_JS_VERSION } from './version.js';

/** HTTP header carrying the client identity, shared with pg-pkg and cryptify.
 *  Value format: `host,host_version,app,app_version`
 *  (e.g. `node,22.1.0,pg-js,1.2.3`). */
export const PG_CLIENT_VERSION_HEADER = 'X-POSTGUARD-CLIENT-VERSION';

const APP = 'pg-js';

/** Coerce a field to a safe, non-empty token. The wire format is
 *  comma-delimited and the servers split on `,` expecting exactly four
 *  fields, so any comma inside a detected value is replaced with `.`.
 *  Exported for unit testing. */
export function sanitizeField(value: string | undefined): string {
  const v = (value ?? '').trim();
  if (!v) return 'unknown';
  return v.replace(/,/g, '.');
}

/** Detect the JS runtime for the `host`/`host_version` fields. Accesses every
 *  global through `globalThis` so it is safe (and type-clean) in browser,
 *  Node, Bun and Deno, and never throws. */
function detectHost(): { host: string; hostVersion: string } {
  const g = globalThis as any;
  if (typeof g.Deno !== 'undefined') {
    return { host: 'deno', hostVersion: g.Deno?.version?.deno ?? 'unknown' };
  }
  if (typeof g.Bun !== 'undefined') {
    return { host: 'bun', hostVersion: g.Bun?.version ?? 'unknown' };
  }
  if (typeof g.process !== 'undefined' && g.process?.versions?.node) {
    return { host: 'node', hostVersion: g.process.versions.node };
  }
  if (typeof g.window !== 'undefined' && typeof g.document !== 'undefined') {
    return { host: 'browser', hostVersion: 'unknown' };
  }
  return { host: 'unknown', hostVersion: 'unknown' };
}

/** Build the default `X-POSTGUARD-CLIENT-VERSION` value for this SDK:
 *  `<runtime>,<runtime_version>,pg-js,<sdk_version>`. Always exactly four
 *  comma-separated fields. */
export function defaultClientVersionHeaderValue(): string {
  const { host, hostVersion } = detectHost();
  return [sanitizeField(host), sanitizeField(hostVersion), APP, sanitizeField(PG_JS_VERSION)].join(
    ','
  );
}
