/**
 * Attribute types carrying the email identity in policies, key requests and
 * signing identities (postguard#236).
 *
 * Defaults are the production pbdf types. Test environments override them
 * with test-scheme types (e.g. `irma-demo.sidn-pbdf.email.email`) — no test
 * environment can issue `pbdf.*` credentials, since those issuer keys are
 * production secrets. Overrides must match the PKG's `PKG_EMAIL_ATTRIBUTE`
 * and cryptify's `email_attribute` settings.
 */
export interface EmailAttributes {
  /** Attribute type for an exact email address. */
  email: string;
  /** Attribute type for an email domain. */
  domain: string;
}

export const DEFAULT_EMAIL_ATTRIBUTES: EmailAttributes = {
  email: 'pbdf.sidn-pbdf.email.email',
  domain: 'pbdf.sidn-pbdf.email.domain',
};

/** Merge partial overrides (from `PostGuardConfig.emailAttributes`) with the defaults. */
export function resolveEmailAttributes(
  overrides?: Partial<EmailAttributes>
): EmailAttributes {
  return { ...DEFAULT_EMAIL_ATTRIBUTES, ...overrides };
}
