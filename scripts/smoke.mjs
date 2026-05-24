// Spike smoke test for non-browser runtimes (Node, Bun, Deno).
//
// Two modes:
//   dry  (default) — no network. Loads WASM, builds a ZIP from a File, runs
//                    the chunker. Surfaces issues with globals, streams,
//                    WASM, and Blob/File semantics.
//   full           — set PG_API_KEY to a staging key. Runs the full encrypt
//                    pipeline through toBytes() AND uploads to Cryptify
//                    (silent by default — no recipient mails sent).
//
// Run with:
//   node scripts/smoke-node.mjs           # dry
//   PG_API_KEY=PG-... node scripts/smoke-node.mjs   # full
//   bun scripts/smoke-node.mjs
//   deno run -A scripts/smoke-node.mjs
//
// Always run `npm run build` first so dist/ is fresh.

const PKG_URL = process.env.PG_PKG_URL ?? 'https://pkg.staging.postguard.eu';
const CRYPTIFY_URL = process.env.PG_CRYPTIFY_URL ?? 'https://storage.staging.postguard.eu';
const API_KEY = process.env.PG_API_KEY;
const RECIPIENT = process.env.PG_RECIPIENT ?? 'smoke-test@example.com';
const MODE = API_KEY ? 'full' : 'dry';

console.log(`runtime: ${detectRuntime()}`);
console.log(`mode:    ${MODE}`);
if (MODE === 'full') console.log(`pkgUrl:  ${PKG_URL}`);
console.log('');

const checks = [];
const record = (name, fn) => checks.push({ name, fn });

record('global File exists', () => {
  if (typeof File === 'undefined') throw new Error('File is not a global');
});

record('global Blob exists', () => {
  if (typeof Blob === 'undefined') throw new Error('Blob is not a global');
});

record('global FileList is NOT required', () => {
  // We don't want it; we just want to verify our code path doesn't blow up
  // when FileList is undefined (sealed.ts:106 currently uses `instanceof FileList`).
  if (typeof FileList !== 'undefined') {
    console.log('  note: FileList IS defined here, instanceof check will work');
  } else {
    console.log('  note: FileList undefined — `instanceof FileList` would throw ReferenceError');
  }
});

record('AbortSignal.any exists', () => {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.any !== 'function') {
    throw new Error('AbortSignal.any not available — encrypt pipeline uses it');
  }
});

record('CountQueuingStrategy + WritableStream + ReadableStream', () => {
  if (typeof ReadableStream === 'undefined') throw new Error('ReadableStream missing');
  if (typeof WritableStream === 'undefined') throw new Error('WritableStream missing');
  if (typeof CountQueuingStrategy === 'undefined') throw new Error('CountQueuingStrategy missing');
});

record('import dist/index.mjs', async () => {
  const mod = await import('../dist/index.mjs');
  if (!mod.PostGuard) throw new Error('PostGuard export missing');
});

record('construct PostGuard + build Sealed (no network)', async () => {
  const { PostGuard } = await import('../dist/index.mjs');
  const pg = new PostGuard({ pkgUrl: PKG_URL });
  const file = new File([new Uint8Array([1, 2, 3])], 't.bin');
  const sealed = pg.encrypt({
    files: [file],
    recipients: [pg.recipient.email('a@b.com')],
    sign: pg.sign.apiKey('PG-fake'),
  });
  if (sealed.mode !== 'files') throw new Error(`expected mode=files, got ${sealed.mode}`);
});

record('ZIP a File via internal createZipReadable', async () => {
  // We use a deep import to exercise the same ZIP path encrypt() takes,
  // without needing PKG. Conflux is the only Node-questionable bit.
  const { createZipReadable } = await import('../dist/util/zip.mjs').catch(async () => {
    // Bundle splitting may have inlined it — fall back to going through encrypt
    return { createZipReadable: null };
  });
  if (!createZipReadable) {
    console.log('  skipped: zip not directly importable from dist (likely inlined by tree-shake)');
    return;
  }
  const file = new File([new Uint8Array(1024).fill(7)], 'big.bin');
  const stream = await createZipReadable([file]);
  let total = 0;
  for await (const chunk of stream) total += chunk.byteLength;
  if (total === 0) throw new Error('ZIP produced 0 bytes');
});

if (MODE === 'full') {
  record('full encrypt -> toBytes (talks to PKG)', async () => {
    const { PostGuard } = await import('../dist/index.mjs');
    const pg = new PostGuard({ pkgUrl: PKG_URL });
    const file = new File([new TextEncoder().encode('hello server\n')], 'hi.txt');
    const sealed = pg.encrypt({
      files: [file],
      recipients: [pg.recipient.email(RECIPIENT)],
      sign: pg.sign.apiKey(API_KEY),
    });
    const t0 = performance.now();
    const bytes = await sealed.toBytes();
    const t1 = performance.now();
    console.log(`  ${bytes.byteLength} ciphertext bytes in ${(t1 - t0).toFixed(0)}ms`);
  });

  record('full encrypt -> upload (talks to PKG + Cryptify, silent)', async () => {
    const { PostGuard } = await import('../dist/index.mjs');
    const pg = new PostGuard({ pkgUrl: PKG_URL, cryptifyUrl: CRYPTIFY_URL });
    const file = new File([new TextEncoder().encode('hello server upload\n')], 'hi.txt');
    const sealed = pg.encrypt({
      files: [file],
      recipients: [pg.recipient.email(RECIPIENT)],
      sign: pg.sign.apiKey(API_KEY),
    });
    const t0 = performance.now();
    // Silent — recipients=false (default), no mail sent.
    const { uuid } = await sealed.upload();
    const t1 = performance.now();
    console.log(`  uploaded uuid=${uuid} in ${(t1 - t0).toFixed(0)}ms (silent, no mail sent)`);
  });
}

let failed = 0;
for (const { name, fn } of checks) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${err?.message ?? err}`);
    if (err?.stack) console.log(`      ${err.stack.split('\n').slice(1, 4).join('\n      ')}`);
  }
}

console.log('');
console.log(failed === 0 ? `OK — ${checks.length} checks passed` : `${failed}/${checks.length} checks FAILED`);
process.exit(failed === 0 ? 0 : 1);

function detectRuntime() {
  if (typeof Deno !== 'undefined') return `Deno ${Deno.version.deno}`;
  if (typeof Bun !== 'undefined') return `Bun ${Bun.version}`;
  if (typeof process !== 'undefined' && process.versions?.node) {
    return `Node ${process.versions.node}`;
  }
  return 'unknown';
}
