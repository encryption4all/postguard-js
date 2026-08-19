// Generate the envelope fixture corpus.
//
// Run once per new format, then commit the output. The corpus is APPEND-ONLY:
// an existing fixture records what some sender actually put on the wire, and
// COMPATIBILITY.md's archival guarantee ("read support for stored artifacts is
// not part of this window; it never drops") is a promise about exactly those
// bytes. Editing one to make a failing test pass would erase the evidence
// rather than fix the regression, which is why check-envelope-fixtures.mjs
// refuses a modification.
//
//   node scripts/generate-envelope-fixtures.mjs [--force]
//
// Without --force it writes only fixtures that do not exist yet, so re-running
// after a change to createEnvelope cannot silently rewrite history.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, '..');
const outDir = join(pkgDir, 'tests', 'fixtures', 'envelopes');
const force = process.argv.includes('--force');

// Actual provenance for the `producedBy` field. This used to be a constant
// string, which answered nothing the fixture's own fields did not — and because
// the corpus is append-only, whatever goes in here is permanent for that file.
// The dirty marker matters: without it a fixture generated from uncommitted work
// would name a commit whose tree never produced these bytes.
function provenance(sdkVersion) {
  const git = (args) => execFileSync('git', args, { cwd: pkgDir, encoding: 'utf8' }).trim();
  let commit = 'unknown commit';
  let dirty = '';
  try {
    commit = git(['rev-parse', 'HEAD']);
    if (git(['status', '--porcelain', '--', pkgDir]) !== '') dirty = ', working tree dirty';
  } catch {
    // Generating outside a checkout is legitimate; recording a commit that is a
    // guess is not.
  }
  return `@e4a/pg-js ${sdkVersion} createEnvelope, generated at postguard-js ${commit}${dirty}`;
}

function versionOf(pkgJsonPath) {
  return JSON.parse(readFileSync(pkgJsonPath, 'utf8')).version;
}

const producedBy = provenance(versionOf(join(pkgDir, 'package.json')));

// From dist/, not src/: the TS sources use `.js` specifiers that bare node does
// not resolve, and the built package is what consumers actually receive — so the
// corpus records what shipped rather than what compiled.
if (!existsSync(join(here, '..', 'dist', 'index.mjs'))) {
  console.error('dist/index.mjs is missing. Run `pnpm build` in packages/pg-js first.');
  process.exit(1);
}
const { createEnvelope } = await import('../dist/index.mjs');

// Deterministic stand-in for a Sealed: fixed bytes, fixed uuid. Nothing here
// may depend on wall-clock time or randomness, or the corpus would churn on
// every run and stop being diffable.
function makeSealed(bytes, uuid = 'fixture-uuid-0000') {
  return {
    mode: 'data',
    canUpload: true,
    async toBytes() {
      return bytes;
    },
    async upload() {
      return { uuid };
    },
  };
}

// Filled deterministically rather than randomly so the bytes are reproducible.
function payload(size) {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = (i * 31 + 7) % 251;
  return out;
}

// The markers as the legacy sender wrote them. Kept local rather than taken from
// src/email/extract.ts — which does not export them anyway — because the check
// below asks whether the legacy body really carries these exact bytes. Sharing
// HEAD's constants would make it agree with HEAD by construction, and the point
// of the fixture is to notice when HEAD drifts.
const ARMOR_BEGIN = '-----BEGIN POSTGUARD MESSAGE-----';
const ARMOR_END = '-----END POSTGUARD MESSAGE-----';

function toBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function envelopeFixture({ name, description, bytes, uploadToCryptify = true }) {
  const sealed = makeSealed(bytes);
  const result = await createEnvelope({
    sealed,
    from: 'sender@example.com',
    unencryptedMessage: 'A fixture message.',
    websiteUrl: 'https://postguard.eu',
    uploadToCryptify,
  });

  const attachment = result.attachment
    ? {
        name: result.attachment.name,
        contentType: result.attachment.type,
        dataBase64: toBase64(new Uint8Array(await result.attachment.arrayBuffer())),
      }
    : null;

  return {
    name,
    description,
    // Recorded so a later reader can tell what produced these bytes without
    // guessing from the shape.
    producedBy,
    tier: result.tier,
    subject: result.subject,
    htmlBody: result.htmlBody,
    plainTextBody: result.plainTextBody,
    attachment,
    uploadUuid: result.uploadUuid,
    // What a reader must be able to recover. A digest rather than a second copy
    // of the ciphertext: the attachment already holds those bytes, and storing
    // them twice doubled every tier-2 fixture for no extra assurance.
    expect: {
      ciphertextSha256: attachment ? sha256(bytes) : null,
      ciphertextLength: attachment ? bytes.length : null,
      uploadUuid: result.uploadUuid,
      // Null, not absent: HEAD emits no body armor, and a reader handed one of
      // these envelopes must recover nothing from the body rather than
      // something. `legacyArmoredFixture` is the only producer that fills it.
      armoredBase64Sha256: null,
    },
  };
}

// The one fixture HEAD cannot produce.
//
// COMPATIBILITY.md's archival guarantee covers in-body ASCII armor, and
// src/email/extract.ts keeps `extractArmoredCiphertext` alive for it — but
// nothing has *emitted* armor since 1.0.1, and teaching createEnvelope to emit
// it again just to have something to record is the exact change that file's
// header forbids. So this fixture comes from the last published sender that
// really did emit it, aliased in devDependencies as `pg-js-legacy-armor`
// (@e4a/pg-js 0.10.0). Those are bytes that reached real mailboxes, which is the
// only kind of bytes this corpus is a promise about.
//
// 0.10.0 predates the tier split, so its result has no `tier` and no
// `uploadUuid`. The fixture records `tier: null` rather than guessing one; see
// the corpus-shape assertion in tests/envelope-archival.test.ts.
async function legacyArmoredFixture({ name, description, bytes }) {
  const legacyDir = join(pkgDir, 'node_modules', 'pg-js-legacy-armor');
  if (!existsSync(legacyDir)) {
    console.error('pg-js-legacy-armor is not installed. Run `pnpm install` at the repo root.');
    process.exit(1);
  }
  const { createEnvelope: createLegacyEnvelope } = await import('pg-js-legacy-armor');

  const result = await createLegacyEnvelope({
    sealed: makeSealed(bytes),
    from: 'sender@example.com',
    unencryptedMessage: 'A fixture message.',
    websiteUrl: 'https://postguard.eu',
  });

  // Derived from `bytes`, NOT by running HEAD's extractArmoredCiphertext over
  // the body: an expectation computed with the reader under test is satisfied by
  // definition, including when the reader is broken. The check below is a
  // separate, deliberately dumb whitespace strip — it confirms the legacy sender
  // really armored these bytes, and it fails loudly if 0.10.0's block ever holds
  // something other than plain wrapped base64 (HEAD's reader additionally strips
  // HTML tags, for clients that re-wrap the block in transit).
  const armoredBase64 = toBase64(bytes);
  const begin = result.htmlBody.indexOf(ARMOR_BEGIN);
  const end = result.htmlBody.indexOf(ARMOR_END, begin);
  if (begin < 0 || end < 0) {
    throw new Error(`pg-js ${versionOf(join(legacyDir, 'package.json'))} emitted no armor block`);
  }
  const inBlock = result.htmlBody.slice(begin + ARMOR_BEGIN.length, end).replace(/\s+/g, '');
  if (inBlock !== armoredBase64) {
    throw new Error("the legacy armor block does not hold this fixture's ciphertext");
  }

  const attachment = {
    name: result.attachment.name,
    contentType: result.attachment.type,
    dataBase64: toBase64(new Uint8Array(await result.attachment.arrayBuffer())),
  };

  return {
    name,
    description,
    producedBy: provenance(versionOf(join(legacyDir, 'package.json'))),
    tier: null,
    subject: result.subject,
    htmlBody: result.htmlBody,
    plainTextBody: result.plainTextBody,
    attachment,
    uploadUuid: null,
    expect: {
      ciphertextSha256: sha256(bytes),
      ciphertextLength: bytes.length,
      uploadUuid: null,
      // A digest of the base64 *string* a reader must hand back, for the same
      // reason ciphertextSha256 is a digest: the attachment above already holds
      // these bytes. It pins the exact string form — standard base64, whitespace
      // stripped — which is what an add-in feeds to pg.open().
      armoredBase64Sha256: sha256(armoredBase64),
    },
  };
}

const fixtures = [
  await envelopeFixture({
    name: 'tier1-url-fragment',
    description:
      'Small payload: ciphertext fits the recipient-side URL fragment, and the ' +
      'postguard.encrypted attachment is also present.',
    bytes: payload(512),
  }),
  await envelopeFixture({
    name: 'tier2-attachment-and-link',
    description:
      'Mid-size payload: postguard.encrypted attachment plus a Cryptify /decrypt?uuid= link ' +
      'in the body. The common path. Sized just past the tier-1 boundary — the tier is what ' +
      'this records, and a larger payload only inflates the corpus.',
    bytes: payload(76_000),
  }),
  await envelopeFixture({
    name: 'tier2-upload-declined',
    description:
      'Tier 2 with uploadToCryptify false: attachment only, no uuid link. Exercises the ' +
      'branch where a reader must fall back to the attachment.',
    bytes: payload(76_000),
    uploadToCryptify: false,
  }),
  await envelopeFixture({
    name: 'tier3-cryptify-link-only',
    description:
      'Payload past PG_MAX_ATTACHMENT_SIZE: no local attachment at all, so the recipient has ' +
      'only the Cryptify link. A reader that keys on the attachment alone finds nothing here, ' +
      'which is the asymmetry that broke the website uuid path (#39).',
    bytes: payload(10 * 1024 * 1024 + 1),
  }),
  await legacyArmoredFixture({
    name: 'legacy-armored-body',
    description:
      'Archived envelope from @e4a/pg-js 0.10.0, the last published sender that emitted an ' +
      'in-body ASCII armor block (1.0.1 no longer does; the drop is what broke Thunderbird ' +
      'detection in postguard-tb-addon#85). Predates the tier split, so it has no tier. ' +
      'Bodies like this are still sitting in real mailboxes, and COMPATIBILITY.md says read ' +
      'support for them never expires — so extractArmoredCiphertext has to keep working.',
    bytes: payload(512),
  }),
];

mkdirSync(outDir, { recursive: true });
let written = 0;
let skipped = 0;
for (const fixture of fixtures) {
  const path = join(outDir, `${fixture.name}.json`);
  if (existsSync(path) && !force) {
    skipped++;
    continue;
  }
  writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
  written++;
  console.log(`  wrote ${fixture.name}.json (${fixture.tier ?? 'no tier'})`);
}
console.log(`${written} written, ${skipped} left alone (already present).`);
if (skipped > 0 && !force) {
  console.log('Existing fixtures are never rewritten. Pass --force only to rebuild deliberately.');
}
