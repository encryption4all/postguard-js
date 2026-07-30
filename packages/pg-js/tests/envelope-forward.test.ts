// Forward direction of the envelope-compat gate (postguard-js#131).
//
// COMPATIBILITY.md keeps "the last two majors" of @e4a/pg-js working, and says
// email envelopes "carry the same guarantee". So an envelope built at HEAD must
// be readable by the published readers still in that window — otherwise a change
// here reaches users running an older add-in before they upgrade, which is how
// postguard-tb-addon#85 happened.
//
// The readers are real published packages, installed under aliases in this
// package's devDependencies:
//   pg-js-reader-v1 -> @e4a/pg-js@1.11.0   (latest 1.x)
//   pg-js-reader-v2 -> @e4a/pg-js@2.3.4    (latest 2.x)
//
// When 3.0 ships, 1.x leaves the window per COMPATIBILITY.md and its alias comes
// out of package.json — deliberately, and in a commit that says so.

import { describe, expect, it } from 'vitest';
import { createEnvelope } from '../src/email/envelope.js';
import * as readerV1 from 'pg-js-reader-v1';
import * as readerV2 from 'pg-js-reader-v2';
import type { Sealed } from '../src/sealed.js';

interface Reader {
  extractCiphertext: (opts: { attachments?: { name: string; data: ArrayBufferLike }[] }) => unknown;
  extractUploadUuid: (html: string) => string | null;
}

const READERS: ReadonlyArray<readonly [string, Reader]> = [
  ['@e4a/pg-js@1.11.0', readerV1 as unknown as Reader],
  ['@e4a/pg-js@2.3.4', readerV2 as unknown as Reader],
];

function makeSealed(bytes: Uint8Array): Sealed {
  return {
    mode: 'data',
    canUpload: true,
    async toBytes() {
      return bytes;
    },
    async upload() {
      return { uuid: 'forward-uuid-0000' };
    },
  } as unknown as Sealed;
}

function payload(size: number): Uint8Array {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = (i * 31 + 7) % 251;
  return out;
}

async function buildAtHead(bytes: Uint8Array) {
  const result = await createEnvelope({
    sealed: makeSealed(bytes),
    from: 'sender@example.com',
    unencryptedMessage: 'Forward-compat probe.',
    websiteUrl: 'https://postguard.eu',
  });
  // `data` is an ArrayBuffer because that is what ExtractCiphertextOptions
  // declares (src/types.ts). A Buffer or a view happens to work today, but it is
  // not what a published reader is typed to accept, and tsconfig.json's
  // `include: ["src"]` means nothing here would flag the drift.
  const attachments = result.attachment
    ? [{ name: result.attachment.name, data: await result.attachment.arrayBuffer() }]
    : [];
  return { result, attachments };
}

// Just past each boundary, so the tier is what is being exercised rather than
// the payload size.
const TIERS = [
  ['tier1', 512],
  ['tier2', 76_000],
  ['tier3', 10 * 1024 * 1024 + 1],
] as const;

describe('envelope forward compatibility', () => {
  // A reader list that resolved to nothing would let every case below pass
  // while testing no cross-version behaviour at all.
  it('the reader set is non-empty and every reader exposes the extractors', () => {
    expect(READERS.length).toBeGreaterThan(0);
    for (const [name, reader] of READERS) {
      expect(typeof reader.extractCiphertext, `${name} extractCiphertext`).toBe('function');
      expect(typeof reader.extractUploadUuid, `${name} extractUploadUuid`).toBe('function');
    }
  });

  describe.each(TIERS.map(([tier, size]) => [tier, size] as const))(
    '%s built at HEAD',
    (tier, size) => {
      it.each(READERS.map(([name, reader]) => [name, reader] as const))(
        'is readable by %s',
        async (_name, reader) => {
          const bytes = payload(size);
          const { result, attachments } = await buildAtHead(bytes);
          expect(result.tier).toBe(tier);

          // Both expectations come from the TIER, never from the output under
          // test. Branching on `attachments.length === 0` or on
          // `result.uploadUuid` would let a HEAD that silently stopped emitting
          // one of them take the other branch and pass — the exact
          // postguard-tb-addon#85 shape this gate is named after. Both are hard
          // invariants in src/email/envelope.ts: only tier 3 omits the
          // attachment, and only tier 1 skips the Cryptify upload.
          const carriesAttachment = tier !== 'tier3';
          const carriesUuid = tier !== 'tier1';

          expect(attachments.length, `${tier} attachment count`).toBe(carriesAttachment ? 1 : 0);
          expect(result.uploadUuid, `${tier} uploadUuid`).toBe(
            carriesUuid ? 'forward-uuid-0000' : null
          );

          const recovered = reader.extractCiphertext({ attachments }) as Uint8Array | null;

          if (carriesAttachment) {
            // Against the payload rather than against `attachments[0].data`, so
            // the assertion covers the whole chain: HEAD put these bytes in the
            // attachment and the published reader got them back out.
            expect(recovered).not.toBeNull();
            expect(Array.from(recovered!)).toEqual(Array.from(bytes));
          } else {
            // Tier 3 carries no attachment by design; the published reader must
            // return null rather than throw, and recover the uuid instead.
            expect(recovered).toBeNull();
          }

          if (carriesUuid) {
            expect(reader.extractUploadUuid(result.htmlBody)).toBe(result.uploadUuid);
          }
        }
      );
    }
  );

  it('preserves the markers installed clients key on', async () => {
    const { result } = await buildAtHead(payload(76_000));
    // Renaming either of these is invisible to every unit test in this package
    // and a silent break for every installed mail client.
    expect(result.attachment?.name).toBe('postguard.encrypted');
    expect(result.attachment?.type).toMatch(/^application\/postguard\b/);
    expect(result.htmlBody).toMatch(/\/(decrypt|download)\?uuid=/);
  });
});
