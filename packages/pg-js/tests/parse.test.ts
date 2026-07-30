// Coverage for the MIME reader consolidated out of apps/outlook-addon in #129.
// It shipped in the add-on with no tests at all, which is part of why the two
// add-ins were free to drift; a round-trip against buildMime is the check that
// actually holds the two halves together.

import { describe, expect, it } from 'vitest';
import { buildMime } from '../src/email/mime.js';
import {
  bodyFromMime,
  isMultipart,
  parseDecryptedMime,
  readMimeHeader,
} from '../src/email/parse.js';

const CRLF = '\r\n';

function utf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe('readMimeHeader', () => {
  const raw = ['Subject: hello', 'X-PostGuard: 0.1', 'To: a@example.com', '', 'body'].join(CRLF);

  it('reads a header case-insensitively', () => {
    expect(readMimeHeader(raw, 'subject')).toBe('hello');
    expect(readMimeHeader(raw, 'SUBJECT')).toBe('hello');
    expect(readMimeHeader(raw, 'X-PostGuard')).toBe('0.1');
  });

  it('returns undefined for an absent header rather than throwing', () => {
    expect(readMimeHeader(raw, 'Reply-To')).toBeUndefined();
    expect(readMimeHeader('', 'Subject')).toBeUndefined();
  });

  it('unfolds a header split across continuation lines', () => {
    const folded = ['References: <one@x>', ' <two@x>', '', 'body'].join(CRLF);
    expect(readMimeHeader(folded, 'References')).toBe('<one@x> <two@x>');
  });

  it('does not read a header-shaped line out of the body', () => {
    const withBody = ['Subject: real', '', 'Subject: not-a-header'].join(CRLF);
    expect(readMimeHeader(withBody, 'Subject')).toBe('real');
  });
});

describe('bodyFromMime and isMultipart', () => {
  it('strips the header block', () => {
    const raw = ['Subject: x', '', 'line one', 'line two'].join(CRLF);
    expect(bodyFromMime(raw)).toBe(`line one${CRLF}line two`);
  });

  it('returns the input unchanged when there is no header separator', () => {
    expect(bodyFromMime('just a body')).toBe('just a body');
  });

  it('detects a multipart content type', () => {
    const multi = ['Content-Type: multipart/mixed; boundary="b"', '', ''].join(CRLF);
    const single = ['Content-Type: text/html; charset=utf-8', '', 'hi'].join(CRLF);
    expect(isMultipart(multi)).toBe(true);
    expect(isMultipart(single)).toBe(false);
    expect(isMultipart('')).toBe(false);
  });
});

describe('parseDecryptedMime', () => {
  it('round-trips a buildMime message with attachments', () => {
    const data = new Uint8Array([1, 2, 3, 250, 0, 128]);
    const mime = utf8(
      buildMime({
        from: 'sender@example.com',
        to: ['rcpt@example.com'],
        subject: 'Round trip',
        htmlBody: '<p>hello</p>',
        attachments: [{ name: 'notes.txt', type: 'text/plain', data: data.buffer }],
      })
    );

    const parsed = parseDecryptedMime(mime);

    expect(parsed.htmlBody).toContain('<p>hello</p>');
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].name).toBe('notes.txt');
    // The bytes matter more than the text: this is the path a decrypted
    // attachment takes back to the user.
    expect(Array.from(parsed.attachments[0].data)).toEqual(Array.from(data));
  });

  it('reads a single-part html message', () => {
    const mime = ['Content-Type: text/html; charset=utf-8', '', '<p>only body</p>'].join(CRLF);
    const parsed = parseDecryptedMime(mime);
    expect(parsed.htmlBody).toBe('<p>only body</p>');
    expect(parsed.plainBody).toBeNull();
    expect(parsed.attachments).toEqual([]);
  });

  it('decodes quoted-printable text', () => {
    const mime = [
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'caf=C3=A9 and a soft=',
      ' break',
    ].join(CRLF);
    expect(parseDecryptedMime(mime).plainBody).toContain('café');
  });

  it('decodes quoted-printable attachment bytes as octets, not as characters', () => {
    // The other half of the same bug: the byte path used to take the
    // one-char-per-octet string and UTF-8 encode it, so every octet above 0x7f
    // came back as two bytes and the attachment was silently corrupted.
    const mime = [
      'Content-Type: application/octet-stream; name="raw.bin"',
      'Content-Disposition: attachment; filename="raw.bin"',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      '=00=C3=A9=FF',
    ].join(CRLF);

    const [att] = parseDecryptedMime(mime).attachments;
    expect(Array.from(att.data)).toEqual([0x00, 0xc3, 0xa9, 0xff]);
  });

  it('decodes base64 text', () => {
    const mime = [
      'Content-Type: text/plain',
      'Content-Transfer-Encoding: base64',
      '',
      btoa('decoded body'),
    ].join(CRLF);
    expect(parseDecryptedMime(mime).plainBody).toBe('decoded body');
  });

  it('recurses into a nested multipart envelope', () => {
    const inner = [
      '--inner',
      'Content-Type: text/plain',
      '',
      'plain part',
      '--inner',
      'Content-Type: text/html',
      '',
      '<p>html part</p>',
      '--inner--',
    ].join(CRLF);
    const mime = [
      'Content-Type: multipart/mixed; boundary="outer"',
      '',
      '--outer',
      'Content-Type: multipart/alternative; boundary="inner"',
      '',
      inner,
      '--outer--',
    ].join(CRLF);

    const parsed = parseDecryptedMime(mime);
    expect(parsed.plainBody).toBe('plain part');
    expect(parsed.htmlBody).toBe('<p>html part</p>');
  });

  it('survives corrupt base64 in an attachment instead of losing the message', () => {
    const mime = [
      'Content-Type: multipart/mixed; boundary="b"',
      '',
      '--b',
      'Content-Type: text/html',
      '',
      '<p>body survives</p>',
      '--b',
      'Content-Type: application/octet-stream; name="broken.bin"',
      'Content-Disposition: attachment; filename="broken.bin"',
      'Content-Transfer-Encoding: base64',
      '',
      '!!!not base64!!!',
      '--b--',
    ].join(CRLF);

    const parsed = parseDecryptedMime(mime);
    // The point: the html body is still recovered. A throwing parser would
    // take the readable part of the message down with the unreadable one.
    expect(parsed.htmlBody).toBe('<p>body survives</p>');
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].data).toHaveLength(0);
  });

  it('treats a boundary-less multipart as empty rather than throwing', () => {
    const mime = ['Content-Type: multipart/mixed', '', 'orphaned'].join(CRLF);
    const parsed = parseDecryptedMime(mime);
    expect(parsed).toEqual({ htmlBody: null, plainBody: null, attachments: [] });
  });
});
