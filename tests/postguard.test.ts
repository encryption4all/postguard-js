import { describe, it, expect, vi, afterEach } from 'vitest';
import { PostGuard } from '../src/postguard.js';
import { RecipientBuilder } from '../src/recipients/builder.js';
import { resolveFiles } from '../src/sealed.js';
import {
  resolveSigningKeysFromYivi,
  buildStartRequestBody,
  parseDisclosedJwt,
  collectRequestedAttrTypes,
} from '../src/signing/yivi.js';
import { YiviSessionError } from '../src/errors.js';

// Build a Yivi session-result JWT (header.payload.sig) with a `disclosed` claim.
function makeDisclosedJwt(disclosed: unknown[][]): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ disclosed })).toString('base64url');
  return `${header}.${payload}.sig`;
}

describe('PostGuard', () => {
  const pg = new PostGuard({
    pkgUrl: 'https://pkg.example.com',
    cryptifyUrl: 'https://cryptify.example.com',
  });

  describe('client-version header injection', () => {
    it('adds X-POSTGUARD-CLIENT-VERSION to config by default', () => {
      const instance = new PostGuard({ pkgUrl: 'https://pkg.example.com' });
      const headers = (instance as any).config.headers as Headers;
      expect(headers.get('X-POSTGUARD-CLIENT-VERSION')).toMatch(/^[^,]+,[^,]*,pg-js,/);
    });

    it('lets a caller-supplied header win (case-insensitive key)', () => {
      const instance = new PostGuard({
        pkgUrl: 'https://pkg.example.com',
        headers: { 'x-postguard-client-version': 'Outlook,1.0,pg4ol,9.9.9' },
      });
      const headers = (instance as any).config.headers as Headers;
      expect(headers.get('X-POSTGUARD-CLIENT-VERSION')).toBe('Outlook,1.0,pg4ol,9.9.9');
    });

    it('preserves other caller headers alongside the default', () => {
      const instance = new PostGuard({
        pkgUrl: 'https://pkg.example.com',
        headers: { 'X-Cryptify-Source': 'mytool' },
      });
      const headers = (instance as any).config.headers as Headers;
      expect(headers.get('X-Cryptify-Source')).toBe('mytool');
      expect(headers.get('X-POSTGUARD-CLIENT-VERSION')).toContain(',pg-js,');
    });
  });

  describe('sign builders', () => {
    it('builds apiKey sign method', () => {
      const sign = pg.sign.apiKey('my-key');
      expect(sign).toEqual({ type: 'apiKey', apiKey: 'my-key' });
    });

    it('builds yivi sign method', () => {
      const sign = pg.sign.yivi({
        element: '#yivi',
        senderEmail: 'sender@example.com',
        includeSender: true,
      });
      expect(sign).toEqual({
        type: 'yivi',
        element: '#yivi',
        senderEmail: 'sender@example.com',
        includeSender: true,
      });
    });

    it('builds yivi sign method without optional includeSender', () => {
      const sign = pg.sign.yivi({ element: '#yivi', senderEmail: 'a@b.com' });
      expect(sign.includeSender).toBeUndefined();
    });
  });

  describe('buildStartRequestBody', () => {
    it('prepends the email attribute (unbound) when no senderEmail given', () => {
      const body = buildStartRequestBody({ element: '#yivi' });
      expect(body).toEqual({ con: [{ t: 'pbdf.sidn-pbdf.email.email' }] });
    });

    it('binds the email attribute when senderEmail is given', () => {
      const body = buildStartRequestBody({
        element: '#yivi',
        senderEmail: 'sender@example.com',
      });
      expect(body).toEqual({
        con: [{ t: 'pbdf.sidn-pbdf.email.email', v: 'sender@example.com' }],
      });
    });

    it('preserves legacy flat attribute entries with optional flag', () => {
      const body = buildStartRequestBody({
        element: '#yivi',
        attributes: [
          { t: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber', optional: true },
        ],
      });
      expect(body).toEqual({
        con: [
          { t: 'pbdf.sidn-pbdf.email.email' },
          { t: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber', optional: true },
        ],
      });
    });

    it('passes through a disjunction-of-conjunctions entry as a nested array', () => {
      const body = buildStartRequestBody({
        element: '#yivi',
        attributes: [
          [
            [{ t: 'pbdf.gemeente.personalData.fullname' }],
            [
              { t: 'pbdf.pbdf.passport.firstName' },
              { t: 'pbdf.pbdf.passport.lastName' },
            ],
          ],
          { t: 'pbdf.gemeente.personalData.dateofbirth', optional: true },
        ],
      });
      expect(body).toEqual({
        con: [
          { t: 'pbdf.sidn-pbdf.email.email' },
          [
            [{ t: 'pbdf.gemeente.personalData.fullname' }],
            [
              { t: 'pbdf.pbdf.passport.firstName' },
              { t: 'pbdf.pbdf.passport.lastName' },
            ],
          ],
          { t: 'pbdf.gemeente.personalData.dateofbirth', optional: true },
        ],
      });
    });

    it('preserves empty inner array marking an optional discon', () => {
      // Per Yivi convention, [[],  [{t: '...'}]] means the discon is optional
      // (the empty alternative is always satisfiable). The empty array must
      // survive the spread unchanged.
      const body = buildStartRequestBody({
        element: '#yivi',
        attributes: [[[], [{ t: 'pbdf.gemeente.personalData.fullname' }]]],
      });
      expect(body).toEqual({
        con: [
          { t: 'pbdf.sidn-pbdf.email.email' },
          [[], [{ t: 'pbdf.gemeente.personalData.fullname' }]],
        ],
      });
    });
  });

  describe('collectRequestedAttrTypes', () => {
    it('returns an empty set when no attributes requested', () => {
      expect(collectRequestedAttrTypes().size).toBe(0);
      expect(collectRequestedAttrTypes([]).size).toBe(0);
    });

    it('collects flat attribute type ids', () => {
      const types = collectRequestedAttrTypes([
        { t: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber' },
        { t: 'pbdf.gemeente.personalData.fullname', optional: true },
      ]);
      expect([...types]).toEqual([
        'pbdf.sidn-pbdf.mobilenumber.mobilenumber',
        'pbdf.gemeente.personalData.fullname',
      ]);
    });

    it('unwraps disjunction-of-conjunctions entries', () => {
      const types = collectRequestedAttrTypes([
        [
          [{ t: 'pbdf.gemeente.personalData.fullname' }],
          [{ t: 'pbdf.pbdf.passport.firstName' }, { t: 'pbdf.pbdf.passport.lastName' }],
        ],
      ]);
      expect(types.has('pbdf.gemeente.personalData.fullname')).toBe(true);
      expect(types.has('pbdf.pbdf.passport.firstName')).toBe(true);
      expect(types.has('pbdf.pbdf.passport.lastName')).toBe(true);
    });
  });

  describe('parseDisclosedJwt', () => {
    it('extracts the email value from the disclosed set', () => {
      const jwt = makeDisclosedJwt([
        [{ id: 'pbdf.sidn-pbdf.email.email', rawvalue: 'alice@example.com' }],
      ]);
      const { email, otherAttrTypes } = parseDisclosedJwt(jwt, new Set());
      expect(email).toBe('alice@example.com');
      expect(otherAttrTypes).toEqual([]);
    });

    it('keeps only attribute types the client actually requested', () => {
      const jwt = makeDisclosedJwt([
        [{ id: 'pbdf.sidn-pbdf.email.email', rawvalue: 'a@b.com' }],
        // Requested — allowed through.
        [{ id: 'pbdf.gemeente.personalData.fullname', rawvalue: 'Alice' }],
        // NOT requested (attacker-injected) — must be dropped.
        [{ id: 'pbdf.pbdf.idin.gender', rawvalue: 'F' }],
      ]);
      const allowed = new Set(['pbdf.gemeente.personalData.fullname']);
      const { otherAttrTypes } = parseDisclosedJwt(jwt, allowed);
      expect(otherAttrTypes).toEqual(['pbdf.gemeente.personalData.fullname']);
    });

    it('de-duplicates repeated allowed attribute ids', () => {
      const jwt = makeDisclosedJwt([
        [{ id: 'pbdf.gemeente.personalData.fullname', rawvalue: 'Alice' }],
        [{ id: 'pbdf.gemeente.personalData.fullname', rawvalue: 'Alice' }],
      ]);
      const allowed = new Set(['pbdf.gemeente.personalData.fullname']);
      const { otherAttrTypes } = parseDisclosedJwt(jwt, allowed);
      expect(otherAttrTypes).toEqual(['pbdf.gemeente.personalData.fullname']);
    });

    it('ignores disclosed entries without a raw value', () => {
      const jwt = makeDisclosedJwt([
        [{ id: 'pbdf.gemeente.personalData.fullname', rawvalue: null }],
      ]);
      const allowed = new Set(['pbdf.gemeente.personalData.fullname']);
      expect(parseDisclosedJwt(jwt, allowed).otherAttrTypes).toEqual([]);
    });

    it('returns an empty result for a malformed JWT', () => {
      expect(parseDisclosedJwt('not-a-jwt', new Set())).toEqual({ otherAttrTypes: [] });
    });
  });

  describe('recipient builders', () => {
    it('builds email recipient', () => {
      const r = pg.recipient.email('alice@example.com');
      expect(r).toBeInstanceOf(RecipientBuilder);
      expect(r.email).toBe('alice@example.com');
      expect(r._baseType).toBe('email');
    });

    it('builds emailDomain recipient', () => {
      const r = pg.recipient.emailDomain('bob@corp.com');
      expect(r).toBeInstanceOf(RecipientBuilder);
      expect(r.email).toBe('bob@corp.com');
      expect(r._baseType).toBe('emailDomain');
    });

    it('chains extraAttribute calls', () => {
      const r = pg.recipient.email('alice@example.com')
        .extraAttribute('pbdf.gemeente.personalData.surname', 'Smith')
        .extraAttribute('pbdf.sidn-pbdf.mobilenumber.mobilenumber', '0612345678');

      expect(r._extras).toEqual([
        { t: 'pbdf.gemeente.personalData.surname', v: 'Smith' },
        { t: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber', v: '0612345678' },
      ]);
    });
  });

  describe('sealed.upload validation', () => {
    it('refuses to upload a ReadableStream payload', async () => {
      const sealed = pg.encrypt({
        data: new ReadableStream<Uint8Array>(),
        recipients: [pg.recipient.email('a@b.com')],
        sign: pg.sign.apiKey('PG-test'),
      });
      await expect(sealed.upload()).rejects.toThrow(
        /does not support data: ReadableStream/
      );
    });

    // Regression: a previous runtime validator hand-maintained an
    // allowlist of upload keys and rejected `onUploadInit` because the
    // type was updated but the allowlist wasn't. The validator has
    // since been removed; this test pins the contract so a future
    // attempt to reintroduce one can't silently re-break the option.
    it('does not reject onUploadInit as an unknown option', async () => {
      const sealed = pg.encrypt({
        files: [new File([new Uint8Array([0])], 'a.bin')],
        recipients: [pg.recipient.email('alice@example.com')],
        sign: pg.sign.apiKey('PG-test'),
      });
      await expect(
        sealed.upload({ onUploadInit: () => {} })
      ).rejects.not.toThrow(/unknown option "onUploadInit"/);
    });
  });

  describe('silent-default notice', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const newPg = () =>
      new PostGuard({
        pkgUrl: 'https://pkg.example.com',
        cryptifyUrl: 'https://cryptify.example.com',
      });

    const newSealed = (instance: PostGuard) =>
      instance.encrypt({
        files: [new File([new Uint8Array([0])], 'a.bin')],
        recipients: [instance.recipient.email('a@b.com')],
        sign: instance.sign.apiKey('PG-test'),
      });

    it('logs once when notify is unset on a fresh PostGuard', async () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      const instance = newPg();
      // Two uploads on the same instance — info should fire exactly once.
      await newSealed(instance).upload().catch(() => {});
      await newSealed(instance).upload().catch(() => {});
      expect(info).toHaveBeenCalledTimes(1);
      expect(info.mock.calls[0][0]).toMatch(/notify is unset — uploading silently/);
    });

    it('does not log when notify is set explicitly (true or false)', async () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      const instance = newPg();
      await newSealed(instance).upload({ notify: { recipients: true } }).catch(() => {});
      await newSealed(newPg()).upload({ notify: { recipients: false } }).catch(() => {});
      expect(info).not.toHaveBeenCalled();
    });
  });

  describe('resolveFiles', () => {
    const sign = pg.sign.apiKey('PG-test');
    const recipients = [pg.recipient.email('a@b.com')];

    it('returns File[] as-is without touching FileList global', () => {
      const files = [new File([new Uint8Array([1])], 'a.bin')];
      // FileList is undefined in Node/Bun/Deno; this must not throw
      // ReferenceError. Regression test for the original bug where
      // `files instanceof FileList` blew up on non-browser runtimes.
      expect(typeof FileList).toBe('undefined');
      const out = resolveFiles({ files, recipients, sign });
      expect(out).toEqual(files);
    });

    it('wraps a Uint8Array data payload as a single File', () => {
      const data = new TextEncoder().encode('hello');
      const out = resolveFiles({ data, recipients, sign });
      expect(out).toHaveLength(1);
      expect(out[0].name).toBe('data.bin');
      expect(out[0].type).toBe('application/octet-stream');
    });

    it('throws on a ReadableStream payload (use toBytes() instead)', () => {
      const data = new ReadableStream<Uint8Array>();
      expect(() => resolveFiles({ data, recipients, sign })).toThrow(
        /cannot wrap a ReadableStream/
      );
    });

    it('throws when neither files nor data given', () => {
      expect(() => resolveFiles({ recipients, sign })).toThrow(/Either files or data/);
    });
  });

  describe('sign.yivi without a DOM', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('throws YiviSessionError upfront when document is undefined', async () => {
      // In Node/Bun/Deno without a DOM polyfill, document is undeclared.
      // We expect a clear error from our upfront guard, not a confusing
      // crash deep inside yivi-web.
      vi.stubGlobal('document', undefined);
      await expect(
        resolveSigningKeysFromYivi('https://pkg.example.com', { element: '#yivi' })
      ).rejects.toBeInstanceOf(YiviSessionError);
      await expect(
        resolveSigningKeysFromYivi('https://pkg.example.com', { element: '#yivi' })
      ).rejects.toThrow(/sign\.yivi requires a DOM/);
    });
  });

  describe('prepareSign', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns a handle with mobileUrl, keys and cancel', () => {
      vi.stubGlobal('document', undefined);
      const prepared = pg.prepareSign({ element: '#yivi' });
      expect(prepared.mobileUrl).toBeInstanceOf(Promise);
      expect(prepared.keys).toBeInstanceOf(Promise);
      expect(typeof prepared.cancel).toBe('function');
      // Swallow the expected DOM-guard rejection so it isn't reported as
      // unhandled by this synchronous assertion test.
      prepared.keys.catch(() => {});
    });

    it('rejects both keys and mobileUrl when no DOM is present', async () => {
      // Without a DOM the session can't start; the early failure must reach
      // whoever awaits the URL, not just whoever awaits the keys.
      vi.stubGlobal('document', undefined);
      const prepared = pg.prepareSign({ element: '#yivi' });
      await expect(prepared.keys).rejects.toBeInstanceOf(YiviSessionError);
      await expect(prepared.mobileUrl).rejects.toBeInstanceOf(YiviSessionError);
    });

    it('rejects immediately when the abort signal is already aborted', async () => {
      // Stub a truthy document so we clear the DOM guard and hit the
      // abort guard (which sits before any yivi-web construction).
      vi.stubGlobal('document', {});
      const prepared = pg.prepareSign({
        element: '#yivi',
        signal: AbortSignal.abort(),
      });
      await expect(prepared.keys).rejects.toThrow(/Aborted/);
    });
  });

  describe('encrypt with pre-resolved signingKeys', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('skips the Yivi session (never touches sign.element) when keys are supplied', async () => {
      // No DOM here: if getSigningKeys did NOT honor the supplied keys, it
      // would fall through to resolveSigningKeysFromYivi and reject with the
      // "requires a DOM" YiviSessionError. Proving the upload rejects for some
      // OTHER reason (no real crypto/network in tests) confirms the pre-warmed
      // keys short-circuited session resolution.
      vi.stubGlobal('document', undefined);
      const sealed = pg.encrypt({
        files: [new File([new Uint8Array([1, 2, 3])], 'a.bin')],
        recipients: [pg.recipient.email('a@b.com')],
        sign: pg.sign.yivi({ element: '#never-rendered' }),
        signingKeys: {
          pubSignKey: 'PUB',
          privSignKey: 'PRIV',
          senderEmail: 'me@example.com',
        },
      });
      await expect(
        sealed.upload({ notify: { recipients: false } })
      ).rejects.not.toThrow(/requires a DOM/);
    });
  });
});
