import type { CreateEnvelopeOptions, EnvelopeResult } from '../types.js';
import { armorBase64, toUrlSafeBase64, PG_ARMOR_DIV_ID, PG_MAX_URL_FRAGMENT_SIZE } from './extract.js';

const DEFAULT_WEBSITE_URL = 'https://postguard.eu';

/** Create an encrypted email envelope (placeholder HTML + attachment) */
export function createEnvelope(options: CreateEnvelopeOptions): EnvelopeResult {
  const { encrypted, from, unencryptedMessage } = options;
  const websiteUrl = options.websiteUrl ?? DEFAULT_WEBSITE_URL;
  const logoUrl = `${websiteUrl}/pg_logo_no_text.png`;

  // Encode encrypted data to base64
  const base64Encrypted = uint8ArrayToBase64(encrypted);

  const fallbackLink = buildFallbackLink(base64Encrypted, websiteUrl);
  const armorDiv = buildArmorDiv(base64Encrypted);
  const messageSection = unencryptedMessage
    ? buildUnencryptedSection(unencryptedMessage)
    : '';

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
                <img src="${logoUrl}" alt="PostGuard" width="82" height="82" style="display:block;margin:0 auto;" />
            </div>
            <div style="background:#FFFFFF;padding:60px 50px;border-radius:8px;text-align:center;">
                <p style="font-size:22px;font-weight:700;color:#030E17;margin:0 0 5px 0;line-height:30px;">
                    ${escapeHtml(from)}
                </p>
                <p style="font-size:16px;color:#5F7381;margin:15px 0 0 0;">
                    sent you an encrypted email via PostGuard.
                </p>${messageSection}
                <p style="font-size:14px;color:#5F7381;margin:25px 0 0 0;">
                    To decrypt this message, you need the
                    <a href="${websiteUrl}" style="color:#3095DE;text-decoration:none;font-weight:600;">PostGuard</a>
                    extension for Thunderbird.
                </p>${fallbackLink}
            </div>
            <div style="height:40px;"></div>
        </div>
    </div>${armorDiv}
</body>
</html>`;

  const plainTextBody = buildPlainText(from, websiteUrl, unencryptedMessage);

  const attachment = new File([encrypted as BlobPart], 'postguard.encrypted', {
    type: 'application/postguard; charset=utf-8',
  });

  return {
    subject: 'PostGuard Encrypted Email',
    htmlBody,
    plainTextBody,
    attachment,
  };
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

function buildFallbackLink(base64Encrypted: string, websiteUrl: string): string {
  if (base64Encrypted.length <= PG_MAX_URL_FRAGMENT_SIZE) {
    const urlSafe = toUrlSafeBase64(base64Encrypted);
    const fallbackUrl = `${websiteUrl}/decrypt#${urlSafe}`;
    return `
                <a href="${fallbackUrl}" style="display:inline-block;font-weight:600;margin:25px 0;max-width:350px;width:100%;background:#030E17;border:none;border-radius:6px;color:#ffffff;padding:14px 0;text-decoration:none;font-size:16px;">
                    Decrypt in your browser
                </a>`;
  }
  return `
                <div style="text-align:left;padding-top:30px;">
                    <p style="color:#5F7381;font-size:16px;font-weight:600;margin:0 0 4px 0;">Decrypt in your browser</p>
                    <a style="color:#3095DE;font-size:13px;font-weight:400;line-height:18px;word-break:break-all;" href="${websiteUrl}/decrypt">
                        Upload the attached postguard.encrypted file at ${websiteUrl}/decrypt
                    </a>
                </div>`;
}

function buildArmorDiv(base64Encrypted: string): string {
  return `\n  <div id="${PG_ARMOR_DIV_ID}" style="display:none;font-size:0;max-height:0;overflow:hidden;mso-hide:all">${armorBase64(base64Encrypted)}</div>`;
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
