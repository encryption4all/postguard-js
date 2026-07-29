// CLI entry point. Run with one of:
//   npm run send     # encrypts and asks Cryptify to mail recipients
//   npm run upload   # encrypts and uploads silently
//   npm start        # same as `npm run send`
//
// Configuration via .env or environment variables — see .env.example.

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  API_KEY,
  CITIZEN_EMAIL,
  ORGANISATION_EMAIL,
  MESSAGE,
  INPUT_FILES,
  DOWNLOAD_URL,
  IS_CRYPTIFY_STAGING,
  CRYPTIFY_URL,
  PKG_URL,
} from './src/config.mjs';
import { encryptAndSend, encryptAndUpload } from './src/encryption.mjs';

if (!API_KEY) {
  console.error('Missing PG_API_KEY. Copy .env.example to .env and set it.');
  process.exit(2);
}

const mode = process.argv.includes('--upload-only') ? 'upload-only' : 'send-email';

console.log(`pg-node example — mode: ${mode}`);
console.log(`  PKG:      ${PKG_URL}`);
console.log(`  Cryptify: ${CRYPTIFY_URL}${IS_CRYPTIFY_STAGING ? '  (staging — no mails actually sent)' : ''}`);
console.log(`  Citizen:      ${CITIZEN_EMAIL}`);
console.log(`  Organisation: ${ORGANISATION_EMAIL}`);
console.log('');

const files = await loadFiles();
console.log(`Encrypting ${files.length} file(s):`);
for (const f of files) console.log(`  ${f.name} (${f.size} bytes)`);
console.log('');

const abortController = new AbortController();
process.on('SIGINT', () => {
  console.log('\nCancelling…');
  abortController.abort();
});

const onProgress = (pct) => {
  process.stdout.write(`\r  upload progress: ${pct}%   `);
};

const t0 = performance.now();
const uuid =
  mode === 'send-email'
    ? await encryptAndSend({
        files,
        citizen: { email: CITIZEN_EMAIL },
        organisation: { email: ORGANISATION_EMAIL },
        apiKey: API_KEY,
        message: MESSAGE,
        onProgress,
        signal: abortController.signal,
      })
    : await encryptAndUpload({
        files,
        citizen: { email: CITIZEN_EMAIL },
        organisation: { email: ORGANISATION_EMAIL },
        apiKey: API_KEY,
        onProgress,
        signal: abortController.signal,
      });
const t1 = performance.now();

process.stdout.write('\n');
console.log('');
console.log(`Done in ${(t1 - t0).toFixed(0)}ms`);
console.log(`UUID:     ${uuid}`);
console.log(`Download: ${DOWNLOAD_URL}/download?uuid=${uuid}`);

if (mode === 'send-email' && IS_CRYPTIFY_STAGING) {
  console.log('');
  console.log('Note: staging Cryptify does not actually deliver mails. Open the URL above to test decrypt.');
}

/** Read each path in PG_INPUT_FILES as a File. If empty, return two demo files. */
async function loadFiles() {
  if (INPUT_FILES.length === 0) {
    return [
      new File(
        [new TextEncoder().encode('This is a sample report for PostGuard encryption testing.\n')],
        'report.txt',
        { type: 'text/plain' }
      ),
      new File(
        [new TextEncoder().encode('Confidential notes — only the intended recipient can read this.\n')],
        'notes.txt',
        { type: 'text/plain' }
      ),
    ];
  }
  return Promise.all(
    INPUT_FILES.map(async (path) => {
      const bytes = await readFile(path);
      return new File([bytes], basename(path));
    })
  );
}
