import { describe, it, expect, vi, afterEach } from 'vitest';
import { PostGuard } from '../src/postguard.js';
import { RecipientBuilder } from '../src/recipients/builder.js';
import { resolveFiles } from '../src/sealed.js';
import {
  resolveSigningKeysFromYivi,
  buildStartRequestBody,
} from '../src/signing/yivi.js';
import { YiviSessionError } from '../src/errors.js';

describe('PostGuard', () => {
  const pg = new PostGuard({
    pkgUrl: 'https://pkg.example.com',
    cryptifyUrl: 'https://cryptify.example.com',
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
});
