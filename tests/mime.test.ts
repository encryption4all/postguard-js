import { describe, it, expect } from 'vitest';
import { buildMime, injectMimeHeaders } from '../src/index.js';

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe('buildMime header sanitization', () => {
  it('builds a basic message with the expected headers', () => {
    const mime = decode(
      buildMime({
        from: 'alice@example.com',
        to: ['bob@example.com'],
        subject: 'Hello',
        htmlBody: '<p>hi</p>',
        date: new Date('2020-01-01T00:00:00Z'),
      })
    );

    expect(mime).toContain('From: alice@example.com\r\n');
    expect(mime).toContain('To: bob@example.com\r\n');
    expect(mime).toContain('Subject: Hello\r\n');
  });

  it('strips CRLF from a malicious subject so no extra header is smuggled in', () => {
    const mime = decode(
      buildMime({
        from: 'alice@example.com',
        to: ['bob@example.com'],
        subject: 'Hello\r\nBcc: eve@evil.com',
        htmlBody: '<p>hi</p>',
      })
    );

    // The Bcc text must not survive as a standalone header line...
    expect(mime).not.toContain('\r\nBcc: eve@evil.com');
    // ...it is folded into the Subject line instead.
    expect(mime).toContain('Subject: Hello Bcc: eve@evil.com\r\n');
  });

  it('sanitizes from, to, cc, inReplyTo and references values', () => {
    const mime = decode(
      buildMime({
        from: 'alice@example.com\r\nX-Injected: 1',
        to: ['bob@example.com\r\nX-To-Injected: 1', 'carol@example.com'],
        cc: ['dave@example.com\nX-Cc-Injected: 1'],
        subject: 'Hi',
        inReplyTo: '<a@x>\r\nX-Reply-Injected: 1',
        references: '<b@x>\r\nX-Ref-Injected: 1',
        htmlBody: '<p>hi</p>',
      })
    );

    // None of the injected values may appear at the start of a line (i.e. as
    // their own header); they are folded into the preceding header value.
    for (const injected of [
      '\r\nX-Injected: 1',
      '\r\nX-To-Injected: 1',
      '\r\nX-Cc-Injected: 1',
      '\r\nX-Reply-Injected: 1',
      '\r\nX-Ref-Injected: 1',
    ]) {
      expect(mime).not.toContain(injected);
    }

    expect(mime).toContain('From: alice@example.com X-Injected: 1\r\n');
    expect(mime).toContain(
      'To: bob@example.com X-To-Injected: 1, carol@example.com\r\n'
    );
    expect(mime).toContain('Cc: dave@example.com X-Cc-Injected: 1\r\n');
  });

  it('sanitizes attachment name and type', () => {
    const mime = decode(
      buildMime({
        from: 'alice@example.com',
        to: ['bob@example.com'],
        subject: 'Hi',
        htmlBody: '<p>hi</p>',
        attachments: [
          {
            name: 'file.txt"\r\nX-Att-Injected: 1',
            type: 'text/plain\r\nX-Type-Injected: 1',
            data: new TextEncoder().encode('data').buffer as ArrayBuffer,
          },
        ],
      })
    );

    expect(mime).not.toContain('\r\nX-Att-Injected: 1');
    expect(mime).not.toContain('\r\nX-Type-Injected: 1');
    // The embedded `"` is backslash-escaped so it cannot terminate the quoted
    // parameter early; the CRLF was already folded to a space.
    expect(mime).toContain('name="file.txt\\" X-Att-Injected: 1"');
    expect(mime).toContain('text/plain X-Type-Injected: 1;');
  });

  it('escapes double-quotes in attachment name/filename so the quoted param cannot be broken out of', () => {
    const mime = decode(
      buildMime({
        from: 'alice@example.com',
        to: ['bob@example.com'],
        subject: 'Hi',
        htmlBody: '<p>hi</p>',
        attachments: [
          {
            // A `"` here would otherwise close the quoted string and let the
            // trailing text be parsed as a separate parameter.
            name: 'evil.txt"; x-malicious="1',
            type: 'text/plain',
            data: new TextEncoder().encode('data').buffer as ArrayBuffer,
          },
        ],
      })
    );

    // The raw, unescaped injection must not appear...
    expect(mime).not.toContain('name="evil.txt";');
    expect(mime).not.toContain('filename="evil.txt";');
    // ...instead the `"` is backslash-escaped inside the quoted string.
    expect(mime).toContain('name="evil.txt\\"; x-malicious=\\"1"');
    expect(mime).toContain('Content-Disposition: attachment; filename="evil.txt\\"; x-malicious=\\"1"');
  });

  it('escapes backslashes in attachment name so the escaping itself cannot be subverted', () => {
    const mime = decode(
      buildMime({
        from: 'alice@example.com',
        to: ['bob@example.com'],
        subject: 'Hi',
        htmlBody: '<p>hi</p>',
        attachments: [
          {
            // A trailing backslash followed by a quote would, without escaping
            // the backslash too, produce `\"` and re-open the injection.
            name: 'a\\"; x="1',
            type: 'text/plain',
            data: new TextEncoder().encode('data').buffer as ArrayBuffer,
          },
        ],
      })
    );

    expect(mime).toContain('name="a\\\\\\"; x=\\"1"');
  });
});

describe('injectMimeHeaders regex escaping', () => {
  const separator = '\r\n\r\n';

  it('removes a header whose name contains regex metacharacters', () => {
    const mime = `From: a@x\r\nX-Weird.Header+Name: keep-me\r\nSubject: hi${separator}body`;

    const out = injectMimeHeaders(mime, {}, ['X-Weird.Header+Name']);

    expect(out).not.toContain('X-Weird.Header+Name: keep-me');
    expect(out).toContain('From: a@x');
    expect(out).toContain('Subject: hi');
  });

  it('does not treat a metacharacter name as a wildcard pattern', () => {
    // `X-.` as a regex would match `X-Anything`; escaped it must not.
    const mime = `From: a@x\r\nX-Anything: keep-me\r\nSubject: hi${separator}body`;

    const out = injectMimeHeaders(mime, {}, ['X-.']);

    expect(out).toContain('X-Anything: keep-me');
  });

  it('still removes and injects normal headers correctly', () => {
    const mime = `From: a@x\r\nX-PostGuard: 0.1\r\nSubject: hi${separator}body`;

    const out = injectMimeHeaders(mime, { 'X-New': 'v' }, ['X-PostGuard']);

    expect(out).not.toContain('X-PostGuard: 0.1');
    expect(out).toContain('X-New: v');
    expect(out.endsWith(`${separator}body`)).toBe(true);
  });
});

describe('injectMimeHeaders header-name/value sanitization', () => {
  const separator = '\r\n\r\n';

  it('strips CRLF from an injected header name so no extra header is smuggled in', () => {
    const mime = `From: a@x\r\nSubject: hi${separator}body`;

    // A CRLF inside the *name* would otherwise start a brand new header line.
    const out = injectMimeHeaders(mime, {
      'X-Legit\r\nBcc: eve@evil.com': 'v',
    });

    expect(out).not.toContain('\r\nBcc: eve@evil.com');
    // The CRLF is folded to a space, keeping the name on one line.
    expect(out).toContain('X-Legit Bcc: eve@evil.com: v');
  });

  it('strips CRLF from an injected header value so no extra header is smuggled in', () => {
    const mime = `From: a@x\r\nSubject: hi${separator}body`;

    const out = injectMimeHeaders(mime, {
      'X-Legit': 'value\r\nBcc: eve@evil.com',
    });

    expect(out).not.toContain('\r\nBcc: eve@evil.com');
    expect(out).toContain('X-Legit: value Bcc: eve@evil.com');
  });

  it('handles a bare LF (no CR) in the name and value too', () => {
    const mime = `From: a@x\r\nSubject: hi${separator}body`;

    const out = injectMimeHeaders(mime, {
      'X-A\nX-Injected-Name: 1': 'v\nX-Injected-Value: 1',
    });

    expect(out).not.toContain('\nX-Injected-Name: 1');
    expect(out).not.toContain('\nX-Injected-Value: 1');
    // The injected content must stay inside the single X-A header line.
    expect(out).toContain('X-A X-Injected-Name: 1: v X-Injected-Value: 1');
    // Body is untouched and still separated correctly.
    expect(out.endsWith(`${separator}body`)).toBe(true);
  });
});
