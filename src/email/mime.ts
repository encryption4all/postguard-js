import type { BuildMimeOptions } from '../types.js';

/**
 * Collapse CR/LF runs in a user-supplied header value to a single space.
 * Prevents header injection (CRLF smuggling of extra headers) when the value
 * is interpolated into a MIME template literal.
 */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ');
}

/**
 * Escape a value for safe insertion into an RFC 2045 quoted-string parameter
 * (e.g. `name="..."` / `filename="..."`). Backslashes and double-quotes are
 * backslash-escaped so a `"` in the value cannot terminate the quoted string
 * early and smuggle in additional parameters. CR/LF are collapsed first so the
 * result stays on a single header line.
 */
function escapeQuotedStringParam(value: string): string {
  return sanitizeHeaderValue(value).replace(/[\\"]/g, '\\$&');
}

/** Escape regex metacharacters so a value can be used literally in `new RegExp()`. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build an inner MIME message for encryption */
export function buildMime(input: BuildMimeOptions): Uint8Array {
  const {
    from,
    to,
    cc = [],
    subject,
    htmlBody,
    plainTextBody,
    date = new Date(),
    inReplyTo,
    references,
    attachments = [],
  } = input;

  const isPlainText = !htmlBody;
  const hasAttachments = attachments.length > 0;
  const bodyContentType = `${isPlainText ? 'text/plain' : 'text/html'}; charset=utf-8`;
  let boundary = '';

  if (hasAttachments) {
    boundary = generateBoundary();
  }

  const contentType = hasAttachments
    ? `multipart/mixed; boundary="${boundary}"`
    : bodyContentType;

  let mime = '';
  mime += `Date: ${date.toUTCString()}\r\n`;
  mime += 'MIME-Version: 1.0\r\n';
  mime += `To: ${to.map(sanitizeHeaderValue).join(', ')}\r\n`;
  mime += `From: ${sanitizeHeaderValue(from)}\r\n`;
  mime += `Subject: ${sanitizeHeaderValue(subject)}\r\n`;
  if (cc.length > 0) mime += `Cc: ${cc.map(sanitizeHeaderValue).join(', ')}\r\n`;
  if (inReplyTo) mime += `In-Reply-To: ${sanitizeHeaderValue(inReplyTo)}\r\n`;
  if (references) mime += `References: ${sanitizeHeaderValue(references)}\r\n`;
  mime += `Content-Type: ${contentType}\r\n`;
  mime += 'X-PostGuard: 0.1\r\n';
  mime += '\r\n';

  const bodyText = isPlainText ? (plainTextBody ?? '') : (htmlBody ?? '');

  if (hasAttachments) {
    mime += `--${boundary}\r\nContent-Type: ${bodyContentType}\r\n\r\n`;
    mime += bodyText;
    mime += '\r\n';

    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      const isLast = i === attachments.length - 1;
      const b64 = arrayBufferToBase64(att.data);
      const formatted = b64.replace(/(.{76})/g, '$1\r\n');

      const attName = escapeQuotedStringParam(att.name);
      const attType = sanitizeHeaderValue(att.type);

      mime += `--${boundary}\r\nContent-Type: ${attType}; name="${attName}"\r\n`;
      mime += `Content-Disposition: attachment; filename="${attName}"\r\n`;
      mime += 'Content-Transfer-Encoding: base64\r\n\r\n';
      mime += formatted;
      mime += isLast ? `\r\n--${boundary}--\r\n` : '\r\n';
    }
  } else {
    mime += bodyText;
  }

  return new TextEncoder().encode(mime);
}

/**
 * Inject headers into a MIME message, optionally removing existing ones first.
 * Handles folded (multi-line) headers correctly.
 */
export function injectMimeHeaders(
  mime: string,
  headersToInject: Record<string, string>,
  headersToRemove?: string[]
): string {
  const separatorIdx = mime.indexOf('\r\n\r\n');
  if (separatorIdx < 0) return mime;

  let headerBlock = mime.slice(0, separatorIdx);
  const body = mime.slice(separatorIdx); // includes leading \r\n\r\n

  if (headersToRemove) {
    for (const name of headersToRemove) {
      const pattern = new RegExp(
        `^${escapeRegExp(name)}:.*(?:\\r\\n[ \\t]+.*)*\\r\\n`,
        'im'
      );
      headerBlock = headerBlock.replace(pattern, '');
    }
  }

  for (const [name, value] of Object.entries(headersToInject)) {
    // Strip CR/LF from both the header name and value so neither can smuggle in
    // extra header lines (CRLF injection). `sanitizeHeaderValue` was previously
    // applied to values elsewhere but not to injected header names.
    headerBlock += `\r\n${sanitizeHeaderValue(name)}: ${sanitizeHeaderValue(value)}`;
  }

  return headerBlock + body;
}

function generateBoundary(): string {
  const rand = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
