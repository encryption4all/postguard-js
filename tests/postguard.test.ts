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
});
