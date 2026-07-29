import { PostGuard } from '@e4a/pg-js';
import { PKG_URL, CRYPTIFY_URL } from './config.mjs';

const pg = new PostGuard({ pkgUrl: PKG_URL, cryptifyUrl: CRYPTIFY_URL });

/** Encrypt, upload to Cryptify, and have Cryptify email each recipient
 *  a download link.
 *
 *  NOTE: the staging Cryptify (storage.staging.postguard.eu) does NOT
 *  actually deliver these emails — recipients won't receive anything on
 *  staging. The upload itself still succeeds. */
export async function encryptAndSend({
  files,
  citizen,
  organisation,
  apiKey,
  message,
  onProgress,
  signal,
}) {
  const sealed = pg.encrypt({
    files,
    recipients: [pg.recipient.email(citizen.email), pg.recipient.emailDomain(organisation.email)],
    sign: pg.sign.apiKey(apiKey),
    onProgress,
    signal,
  });

  const result = await sealed.upload({
    notify: {
      recipients: true,
      message: message || undefined,
      language: 'EN',
    },
  });

  return result.uuid;
}

/** Encrypt and upload to Cryptify silently (no Cryptify-sent emails).
 *  Returns the UUID for distribution through some other channel. */
export async function encryptAndUpload({
  files,
  citizen,
  organisation,
  apiKey,
  onProgress,
  signal,
}) {
  const sealed = pg.encrypt({
    files,
    recipients: [pg.recipient.email(citizen.email), pg.recipient.emailDomain(organisation.email)],
    sign: pg.sign.apiKey(apiKey),
    onProgress,
    signal,
  });

  const result = await sealed.upload();
  return result.uuid;
}
