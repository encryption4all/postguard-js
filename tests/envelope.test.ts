import { describe, expect, it, vi } from 'vitest';
import { createEnvelope } from '../src/email/envelope.js';
import type { Sealed } from '../src/sealed.js';

function makeSealed(
  bytes: Uint8Array,
  toBytesSpy?: () => void,
  uploadImpl?: () => Promise<{ uuid: string }>
): Sealed {
  return {
    mode: 'data',
    canUpload: true,
    async toBytes() {
      toBytesSpy?.();
      return bytes;
    },
    upload: uploadImpl ?? (async () => ({ uuid: 'test-uuid-1234' })),
  } as unknown as Sealed;
}

describe('createEnvelope tier selection', () => {
  it('tier 1: includes base64 in URL fragment', async () => {
    const small = new Uint8Array(100).fill(0x41); // 100 bytes → base64 ~136 chars
    const result = await createEnvelope({ sealed: makeSealed(small), from: 'a@b.c' });
    expect(result.tier).toBe('tier1');
    expect(result.attachment).not.toBeNull();
    expect(result.uploadUuid).toBeNull();
    // The fragment link encodes the ciphertext; some base64 char must appear.
    expect(result.htmlBody).toContain('/decrypt#');
  });

  it('tier 2: uploads to cryptify, no base64 in body', async () => {
    // Just past tier-1 boundary: base64 length > 100_000 → ~75_001 bytes
    const mid = new Uint8Array(80_000).fill(0x42);
    const result = await createEnvelope({ sealed: makeSealed(mid), from: 'a@b.c' });
    expect(result.tier).toBe('tier2');
    expect(result.attachment).not.toBeNull();
    expect(result.uploadUuid).toBe('test-uuid-1234');
    expect(result.htmlBody).toContain('uuid=test-uuid-1234');
    expect(result.htmlBody).not.toContain('/decrypt#');
  });

  it('tier 3: no local attachment, cryptify link', async () => {
    const big = new Uint8Array(11 * 1024 * 1024); // > PG_MAX_ATTACHMENT_SIZE
    const result = await createEnvelope({ sealed: makeSealed(big), from: 'a@b.c' });
    expect(result.tier).toBe('tier3');
    expect(result.attachment).toBeNull();
    expect(result.uploadUuid).toBe('test-uuid-1234');
  });

  it('does not base64-encode the ciphertext for tier 2/3', async () => {
    // Spy on btoa: tier 2/3 must not invoke it on the full payload.
    const btoaSpy = vi.spyOn(globalThis, 'btoa');

    const mid = new Uint8Array(80_000).fill(0x42);
    await createEnvelope({ sealed: makeSealed(mid), from: 'a@b.c' });
    expect(btoaSpy).not.toHaveBeenCalled();

    btoaSpy.mockClear();
    const big = new Uint8Array(11 * 1024 * 1024);
    await createEnvelope({ sealed: makeSealed(big), from: 'a@b.c' });
    expect(btoaSpy).not.toHaveBeenCalled();

    btoaSpy.mockRestore();
  });

  it('still base64-encodes for tier 1', async () => {
    const btoaSpy = vi.spyOn(globalThis, 'btoa');
    const small = new Uint8Array(100).fill(0x41);
    await createEnvelope({ sealed: makeSealed(small), from: 'a@b.c' });
    expect(btoaSpy).toHaveBeenCalled();
    btoaSpy.mockRestore();
  });

  it('tier 3: rejects when the Cryptify upload fails', async () => {
    const big = new Uint8Array(11 * 1024 * 1024); // > PG_MAX_ATTACHMENT_SIZE
    const uploadErr = new Error('cryptify down');
    const sealed = makeSealed(big, undefined, async () => {
      throw uploadErr;
    });
    await expect(createEnvelope({ sealed, from: 'a@b.c' })).rejects.toBe(uploadErr);
  });

  it('tier 2: resolves when the Cryptify upload fails (attachment is the fallback)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mid = new Uint8Array(80_000).fill(0x42);
    const sealed = makeSealed(mid, undefined, async () => {
      throw new Error('cryptify down');
    });
    const result = await createEnvelope({ sealed, from: 'a@b.c' });
    expect(result.tier).toBe('tier2');
    expect(result.attachment).not.toBeNull();
    expect(result.uploadUuid).toBeNull();
    expect(result.htmlBody).toContain('Upload the attached postguard.encrypted file');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('createEnvelope websiteUrl validation', () => {
  const small = () => new Uint8Array(100).fill(0x41); // tier 1

  it('defaults to https://postguard.eu when websiteUrl is omitted', async () => {
    const result = await createEnvelope({ sealed: makeSealed(small()), from: 'a@b.c' });
    expect(result.htmlBody).toContain('src="https://postguard.eu/pg_logo.png"');
    expect(result.htmlBody).toContain('href="https://postguard.eu/decrypt#');
  });

  it('accepts a valid custom https URL', async () => {
    const result = await createEnvelope({
      sealed: makeSealed(small()),
      from: 'a@b.c',
      websiteUrl: 'https://example.com',
    });
    expect(result.htmlBody).toContain('src="https://example.com/pg_logo.png"');
    expect(result.htmlBody).toContain('href="https://example.com/decrypt#');
  });

  it('normalizes a trailing slash so paths do not double up', async () => {
    const result = await createEnvelope({
      sealed: makeSealed(small()),
      from: 'a@b.c',
      websiteUrl: 'https://example.com/',
    });
    expect(result.htmlBody).toContain('src="https://example.com/pg_logo.png"');
    expect(result.htmlBody).not.toContain('https://example.com//');
  });

  it('rejects a javascript: scheme', async () => {
    await expect(
      createEnvelope({
        sealed: makeSealed(small()),
        from: 'a@b.c',
        websiteUrl: 'javascript:alert(1)',
      })
    ).rejects.toThrow(/https: scheme/);
  });

  it('rejects a data: scheme', async () => {
    await expect(
      createEnvelope({
        sealed: makeSealed(small()),
        from: 'a@b.c',
        websiteUrl: 'data:text/html,<script>alert(1)</script>',
      })
    ).rejects.toThrow(/https: scheme/);
  });

  it('rejects a plain http: scheme', async () => {
    await expect(
      createEnvelope({
        sealed: makeSealed(small()),
        from: 'a@b.c',
        websiteUrl: 'http://example.com',
      })
    ).rejects.toThrow(/https: scheme/);
  });

  it('rejects a non-absolute / malformed URL', async () => {
    await expect(
      createEnvelope({
        sealed: makeSealed(small()),
        from: 'a@b.c',
        websiteUrl: 'not a url',
      })
    ).rejects.toThrow(/well-formed absolute URL/);
  });

  it('neutralizes attribute-breaking characters instead of embedding them verbatim', async () => {
    const result = await createEnvelope({
      sealed: makeSealed(small()),
      from: 'a@b.c',
      websiteUrl: 'https://example.com/"><script>alert(1)</script>',
    });
    // The raw closing-tag payload must never appear verbatim in the attribute.
    expect(result.htmlBody).not.toContain('"><script>');
    expect(result.htmlBody).not.toContain('<script>alert(1)</script>');
    // The parser percent-encodes the dangerous characters.
    expect(result.htmlBody).toContain('src="https://example.com/%22%3E%3Cscript%3E');
  });
});
