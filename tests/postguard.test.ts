import { describe, it, expect } from 'vitest';
import { PostGuard } from '../src/postguard.js';
import { RecipientBuilder } from '../src/recipients/builder.js';

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
    const newSealed = () =>
      pg.encrypt({
        files: [new File([new Uint8Array([0])], 'a.bin')],
        recipients: [pg.recipient.email('alice@example.com')],
        sign: pg.sign.apiKey('PG-test'),
      });

    it('accepts undefined opts', async () => {
      const sealed = newSealed();
      // Validator passes; failure (if any) is from the downstream pipeline, not validation.
      await expect(sealed.upload()).rejects.not.toThrow(/sealed\.upload/);
    });

    it('rejects boolean notify', async () => {
      const sealed = newSealed();
      // @ts-expect-error — intentionally wrong shape
      await expect(sealed.upload({ notify: true })).rejects.toThrow(
        /A plain boolean is a common mistake/
      );
    });

    it('rejects top-level recipients (forgot to nest under notify)', async () => {
      const sealed = newSealed();
      // @ts-expect-error — intentionally wrong shape
      await expect(sealed.upload({ recipients: true })).rejects.toThrow(
        /unknown option "recipients"/
      );
    });

    it('rejects unknown notify key', async () => {
      const sealed = newSealed();
      // @ts-expect-error — intentionally wrong shape
      await expect(sealed.upload({ notify: { recipient: true } })).rejects.toThrow(
        /unknown key "recipient"/
      );
    });

    it('rejects non-object opts', async () => {
      const sealed = newSealed();
      // @ts-expect-error — intentionally wrong shape
      await expect(sealed.upload(true)).rejects.toThrow(/expects an object/);
    });

    it('accepts valid notify shape', async () => {
      const sealed = newSealed();
      await expect(
        sealed.upload({ notify: { recipients: true, sender: false, language: 'NL' } })
      ).rejects.not.toThrow(/sealed\.upload/);
    });
  });
});
