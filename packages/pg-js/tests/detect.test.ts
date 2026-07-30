// Detection and the archival armor readers, consolidated in #129.
//
// Detection used to live in each add-in, which is how tier 3 came to be handled
// inconsistently: a host that checks only for the attachment misses every
// message whose ciphertext is in Cryptify (#39).

import { describe, expect, it } from 'vitest';
import {
  POSTGUARD_ENCRYPTED_FILENAME,
  detectPostGuard,
  extractArmoredCiphertext,
  looksLikeArmoredPostGuard,
} from '../src/email/extract.js';

const ARMOR_BEGIN = '-----BEGIN POSTGUARD MESSAGE-----';
const ARMOR_END = '-----END POSTGUARD MESSAGE-----';

describe('detectPostGuard', () => {
  it('detects tier 1 and 2 by the attachment name', () => {
    expect(detectPostGuard({ attachmentNames: [POSTGUARD_ENCRYPTED_FILENAME] })).toBe(true);
    expect(detectPostGuard({ attachmentNames: ['report.pdf', POSTGUARD_ENCRYPTED_FILENAME] })).toBe(
      true
    );
  });

  it('detects tier 3, which ships no attachment at all', () => {
    // The whole reason this predicate is shared. A host checking only the
    // attachment silently fails to detect every tier-3 message.
    expect(
      detectPostGuard({
        attachmentNames: [],
        htmlBody: '<a href="https://postguard.eu/decrypt?uuid=abc-123">Decrypt</a>',
      })
    ).toBe(true);
    expect(
      detectPostGuard({ htmlBody: '<a href="https://postguard.eu/download?uuid=xyz">Get</a>' })
    ).toBe(true);
  });

  it('detects an archived armor-only message', () => {
    expect(detectPostGuard({ htmlBody: `<pre>${ARMOR_BEGIN}\nZm9v\n${ARMOR_END}</pre>` })).toBe(
      true
    );
  });

  it('says no for an ordinary message', () => {
    expect(detectPostGuard({})).toBe(false);
    expect(detectPostGuard({ attachmentNames: [], htmlBody: '' })).toBe(false);
    expect(
      detectPostGuard({
        attachmentNames: ['invoice.pdf'],
        htmlBody: '<p>See attached, and visit https://postguard.eu for details.</p>',
      })
    ).toBe(false);
  });

  it('does not match a near-miss attachment name', () => {
    expect(detectPostGuard({ attachmentNames: ['postguard.encrypted.txt'] })).toBe(false);
    expect(detectPostGuard({ attachmentNames: ['POSTGUARD.ENCRYPTED'] })).toBe(false);
  });
});

describe('extractArmoredCiphertext', () => {
  it('recovers the payload and strips whitespace', () => {
    const body = `${ARMOR_BEGIN}\nZm9v\nYmFy\n${ARMOR_END}`;
    expect(extractArmoredCiphertext(body)).toBe('Zm9vYmFy');
  });

  it('strips HTML tags a mail client wrapped around the block', () => {
    const body = `<div>${ARMOR_BEGIN}<br>Zm9v<br>YmFy<br>${ARMOR_END}</div>`;
    expect(extractArmoredCiphertext(body)).toBe('Zm9vYmFy');
  });

  it('returns null when the block is absent or unterminated', () => {
    expect(extractArmoredCiphertext('')).toBeNull();
    expect(extractArmoredCiphertext('<p>ordinary mail</p>')).toBeNull();
    expect(extractArmoredCiphertext(`${ARMOR_BEGIN}\nZm9v`)).toBeNull();
  });
});

describe('looksLikeArmoredPostGuard', () => {
  it('is true for a truncated block that extract cannot parse', () => {
    const truncated = `${ARMOR_BEGIN}\nZm9v`;
    // The pair matters: this is how a reader reports "PostGuard message I
    // cannot read" instead of treating it as ordinary mail and saying nothing.
    expect(looksLikeArmoredPostGuard(truncated)).toBe(true);
    expect(extractArmoredCiphertext(truncated)).toBeNull();
  });

  it('is false for ordinary mail', () => {
    expect(looksLikeArmoredPostGuard('')).toBe(false);
    expect(looksLikeArmoredPostGuard('<p>hello</p>')).toBe(false);
  });
});
