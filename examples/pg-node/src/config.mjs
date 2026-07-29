// Env-driven config. `.env` is loaded automatically by the npm scripts
// via Node's `--env-file-if-exists`. Mirrors pg-sveltekit's config.ts.

export const PKG_URL = process.env.PG_PKG_URL || 'https://pkg.staging.postguard.eu';
export const CRYPTIFY_URL = process.env.PG_CRYPTIFY_URL || 'https://storage.staging.postguard.eu';
export const API_KEY = process.env.PG_API_KEY;

// Citizen = exact email recipient; Organisation = email-domain recipient.
// Mirrors the "Informatierijk notificeren" use-case from pg-sveltekit.
export const CITIZEN_EMAIL = process.env.PG_CITIZEN_EMAIL || 'citizen@example.com';
export const ORGANISATION_EMAIL = process.env.PG_ORGANISATION_EMAIL || 'noreply@example.org';

export const MESSAGE = process.env.PG_MESSAGE || '';

// Files to encrypt. If unset, the example creates two in-memory demo files.
export const INPUT_FILES = (process.env.PG_INPUT_FILES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Same staging heuristic as pg-sveltekit: the staging Cryptify accepts
// uploads but does NOT actually deliver notification emails. Useful for
// integration testing without spamming real inboxes.
function detectStagingCryptify(url) {
  try {
    return new URL(url).hostname.toLowerCase().includes('staging');
  } catch {
    return false;
  }
}
export const IS_CRYPTIFY_STAGING = detectStagingCryptify(CRYPTIFY_URL);

export const DOWNLOAD_URL =
  process.env.PG_DOWNLOAD_URL ||
  (IS_CRYPTIFY_STAGING ? 'https://staging.postguard.eu' : 'https://postguard.eu');
