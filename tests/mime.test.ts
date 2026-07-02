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
    expect(mime).toContain('name="file.txt" X-Att-Injected: 1"');
    expect(mime).toContain('text/plain X-Type-Injected: 1;');
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
