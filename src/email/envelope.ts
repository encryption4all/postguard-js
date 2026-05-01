import type { CreateEnvelopeOptions, EnvelopeResult, EnvelopeTier } from '../types.js';
import {
  toUrlSafeBase64,
  PG_MAX_URL_FRAGMENT_SIZE,
  PG_MAX_ATTACHMENT_SIZE,
} from './extract.js';

const DEFAULT_WEBSITE_URL = 'https://postguard.eu';

/** Create an encrypted email envelope (placeholder HTML + optional attachment).
 *
 *  Three size tiers, picked from the encrypted byte length:
 *
 *    Tier 1  ciphertext base64 ≤ PG_MAX_URL_FRAGMENT_SIZE
 *      • Local attachment: yes
 *      • Cryptify upload:  no
 *      • Body link:        /decrypt#<base64-in-fragment>
 *
 *    Tier 2  ciphertext bytes  ≤ PG_MAX_ATTACHMENT_SIZE
 *      • Local attachment: yes
 *      • Cryptify upload:  yes (unless options.uploadToCryptify === false)
 *      • Body link:        /decrypt?uuid=…  (data mode)
 *                          /download?uuid=… (files mode)
 *
 *    Tier 3  ciphertext bytes  > PG_MAX_ATTACHMENT_SIZE
 *      • Local attachment: no  (too large to send via SMTP/Exchange)
 *      • Cryptify upload:  yes (always — there is no fallback)
 *      • Body link:        /decrypt?uuid=…  (data mode)
 *                          /download?uuid=… (files mode)
 *
 *  Note: the prior in-body armor block (a hidden div carrying the full
 *  base64 ciphertext) is no longer emitted. It pushed bodies past
 *  Outlook's 1 M-char setAsync limit and was redundant with the
 *  attachment / fragment link. */
export async function createEnvelope(options: CreateEnvelopeOptions): Promise<EnvelopeResult> {
  const { sealed, from, unencryptedMessage, senderAttributes } = options;
  const websiteUrl = options.websiteUrl ?? DEFAULT_WEBSITE_URL;
  const uploadToCryptify = options.uploadToCryptify ?? true;
  const logoUrl = `${websiteUrl}/pg_logo.png`;

  const encrypted = await sealed.toBytes();
  const base64Encrypted = uint8ArrayToBase64(encrypted);

  // Pick tier from the encrypted size.
  const tier = pickTier(encrypted.length, base64Encrypted.length);

  let uploadUuid: string | null = null;
  let fallbackLink: string;

  if (tier === 'tier1') {
    fallbackLink = buildSmallFallbackLink(base64Encrypted, websiteUrl);
  } else {
    // Tier 2 or 3 — both want a Cryptify-backed link in the body, but
    // tier 2 will also keep the local attachment and may opt out of the
    // upload entirely.
    const tryUpload =
      tier === 'tier3' /* tier 3 has no fallback so always try */ ||
      (tier === 'tier2' && uploadToCryptify && sealed.canUpload);

    if (tryUpload) {
      try {
        const result = await sealed.upload();
        uploadUuid = result.uuid;
      } catch {
        // Network / CORS / Cryptify-unavailable. Fall through to
        // manual-upload instructions; tier 2 still has the attachment.
      }
    }

    if (uploadUuid) {
      const route = sealed.mode === 'data' ? 'decrypt' : 'download';
      const downloadUrl = `${websiteUrl}/${route}?uuid=${uploadUuid}`;
      fallbackLink = buildDownloadLink(downloadUrl);
    } else {
      fallbackLink = buildManualUploadLink(websiteUrl);
    }
  }

  const messageSection = unencryptedMessage
    ? buildUnencryptedSection(unencryptedMessage)
    : '';
  const checkmarkUrl = `${websiteUrl}/checkmark.png`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title></title>
</head>
<body style="background:#F2F8FD;background-color:#F2F8FD;font-family:Overpass,sans-serif;line-height:25px;color:#030E17;margin:0;padding:0">
    <div style="background:#F2F8FD;background-color:#F2F8FD;padding:1em;">
        <div style="background:#F2F8FD;width:100%;max-width:600px;margin-left:auto;margin-right:auto;text-align:center;">
            <div style="margin:50px 0 20px 0">
                <img src="${logoUrl}" alt="PostGuard" width="200" height="109" style="display:block;margin:0 auto;" />
            </div>
            <div style="background:#FFFFFF;padding:60px 50px;border-radius:8px;text-align:center;">
                <p style="font-size:22px;font-weight:700;color:#030E17;margin:0 0 5px 0;line-height:30px;">
                    You received an encrypted email
                </p>
                <p style="font-size:14px;color:#5F7381;margin:15px 0 0 0;">
                    This email is protected with PostGuard encryption.
                </p>${messageSection}${fallbackLink}
                <div style="text-align:left;padding-top:30px;">
                    <p style="color:#5F7381;font-size:16px;font-weight:600;margin:0 0 4px 0;">Or use our extension</p>
                    <a style="color:#3095DE;font-size:13px;font-weight:400;line-height:18px;word-break:break-all;" href="${websiteUrl}/addons">
                        Decrypt seamlessly with the PostGuard extension for your email client
                    </a>
                </div>
                <div style="margin-top:40px;padding-top:30px;border-top:1px solid #C6E2F6;text-align:center;">
                    <p style="font-size:13px;color:#5F7381;margin:0 0 6px 0;">Sent by</p>
                    <p style="font-size:15px;font-weight:700;color:#030E17;margin:0 0 12px 0;"><img src="${checkmarkUrl}" alt="" width="14" height="12" style="vertical-align:middle;margin-right:6px;display:inline-block;" />${escapeHtml(from)}</p>${buildAttributePills(senderAttributes)}
                </div>
            </div>
            <div style="height:40px;"></div>
        </div>
    </div>
</body>
</html>`;

  const plainTextBody = buildPlainText(from, websiteUrl, unencryptedMessage);

  // Tier 3: skip the local attachment entirely. Tier 1 + 2: include it.
  const attachment =
    tier === 'tier3'
      ? null
      : new File([encrypted as BlobPart], 'postguard.encrypted', {
          type: 'application/postguard; charset=utf-8',
        });

  return {
    subject: 'PostGuard Encrypted Email',
    htmlBody,
    plainTextBody,
    attachment,
    tier,
    uploadUuid,
  };
}

function pickTier(encryptedBytes: number, base64Length: number): EnvelopeTier {
  if (base64Length <= PG_MAX_URL_FRAGMENT_SIZE) return 'tier1';
  if (encryptedBytes <= PG_MAX_ATTACHMENT_SIZE) return 'tier2';
  return 'tier3';
}

function buildPlainText(from: string, websiteUrl: string, unencryptedMessage?: string): string {
  let text = `PostGuard Encrypted Email

This email from ${from} is encrypted using PostGuard.
To decrypt this message, you need the PostGuard extension for Thunderbird.
Visit ${websiteUrl} for more information.`;

  if (unencryptedMessage) {
    text += `\n\n--- Unencrypted message from sender ---\n${unencryptedMessage}`;
  }

  return text;
}

function buildUnencryptedSection(message: string): string {
  return `
                <div style="text-align:left;padding:20px 24px;margin:30px 0;font-size:14px;background:#F2F8FD;color:#030E17;line-height:22px;">
                    ${escapeHtml(message)}
                </div>`;
}

function buildSmallFallbackLink(base64Encrypted: string, websiteUrl: string): string {
  const urlSafe = toUrlSafeBase64(base64Encrypted);
  const fallbackUrl = `${websiteUrl}/decrypt#${urlSafe}`;
  return `
                <a href="${fallbackUrl}" style="display:inline-block;font-weight:600;margin:25px 0;max-width:350px;width:100%;background:#030E17;border:none;border-radius:6px;color:#ffffff;padding:14px 0;text-decoration:none;font-size:16px;">
                    Decrypt in your browser
                </a>`;
}

function buildDownloadLink(downloadUrl: string): string {
  return `
                <a href="${downloadUrl}" style="display:inline-block;font-weight:600;margin:25px 0;max-width:350px;width:100%;background:#030E17;border:none;border-radius:6px;color:#ffffff;padding:14px 0;text-decoration:none;font-size:16px;">
                    Decrypt in your browser
                </a>`;
}

function buildManualUploadLink(websiteUrl: string): string {
  return `
                <div style="text-align:left;padding-top:30px;">
                    <p style="color:#5F7381;font-size:16px;font-weight:600;margin:0 0 4px 0;">Decrypt in your browser</p>
                    <a style="color:#3095DE;font-size:13px;font-weight:400;line-height:18px;word-break:break-all;" href="${websiteUrl}/decrypt">
                        Upload the attached postguard.encrypted file at ${websiteUrl}/decrypt
                    </a>
                </div>`;
}

function buildAttributePills(attributes?: string[]): string {
  if (!attributes || attributes.length === 0) return '';
  const pills = attributes
    .map(
      (attr) =>
        `<span style="display:inline-block;border:1px solid #C6E2F6;border-radius:100px;padding:4px 14px;margin:3px 4px;font-size:12px;color:#5F7381;">${escapeHtml(attr)}</span>`
    )
    .join('');
  return `\n                    <div style="text-align:center;">${pills}</div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}
