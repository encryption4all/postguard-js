// Reading the MIME message that comes back out of a decrypt.
//
// `buildMime` in ./mime.ts writes the inner message; this is the other half.
// It lived in apps/outlook-addon/src/lib/mime.ts, where Thunderbird could not
// reach it, so the two add-ins were drifting apart on the shape they agreed to
// exchange (encryption4all/postguard-js#129).
//
// Deliberately NOT a general RFC 5322 parser. It handles what `buildMime`
// produces and what mail clients do to it in transit: a single text part or a
// multipart/* envelope, base64 and quoted-printable transfer encodings, folded
// headers. Anything else is passed through rather than rejected — a reader
// that throws on an unfamiliar message is worse than one that returns what it
// could find, because the ciphertext is usually still recoverable.

/** One attachment recovered from a decrypted MIME message. */
export interface ParsedAttachment {
  name: string;
  type: string;
  data: Uint8Array;
}

/** The user-facing content of a decrypted MIME message. */
export interface ParsedMessage {
  htmlBody: string | null;
  plainBody: string | null;
  attachments: ParsedAttachment[];
}

interface RawPart {
  headers: Record<string, string>;
  body: string;
}

/** Read a single header value by name, case-insensitively, from a raw MIME
 *  blob. Continuation lines are unfolded first, so a header split across lines
 *  by a sending client reads back as one value. Returns undefined when absent. */
export function readMimeHeader(rawMime: string, name: string): string | undefined {
  if (!rawMime) return undefined;
  const lcName = name.toLowerCase();
  // The header section ends at the first blank line, CRLF or LF: a body
  // containing something that looks like a header must not be searched.
  const headerEnd = rawMime.search(/\r?\n\r?\n/);
  const headerSection = headerEnd >= 0 ? rawMime.slice(0, headerEnd) : rawMime;
  const unfolded = headerSection.replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    if (line.slice(0, idx).trim().toLowerCase() === lcName) {
      return line.slice(idx + 1).trim();
    }
  }
  return undefined;
}

/** Strip the header block and return the body. For a multipart message this is
 *  the raw multipart body including boundaries — use `parseDecryptedMime` when
 *  you want the parts. */
export function bodyFromMime(rawMime: string): string {
  const headerEnd = rawMime.search(/\r?\n\r?\n/);
  return headerEnd >= 0 ? rawMime.slice(headerEnd).replace(/^\r?\n\r?\n/, '') : rawMime;
}

/** True when the message declares a `multipart/*` Content-Type. */
export function isMultipart(rawMime: string): boolean {
  const ct = readMimeHeader(rawMime, 'Content-Type') ?? '';
  return /^multipart\//i.test(ct);
}

/** Pull the user-facing body and any attachments out of a decrypted MIME blob.
 *
 *  Handles a single text part or a nested multipart/* envelope, and decodes
 *  base64 and quoted-printable. Other transfer encodings (7bit, 8bit, binary)
 *  are already the bytes they claim to be and pass through untouched. */
export function parseDecryptedMime(rawMime: string): ParsedMessage {
  const result: ParsedMessage = { htmlBody: null, plainBody: null, attachments: [] };
  collectParts(rawMime, result);
  return result;
}

function splitHeadersAndBody(raw: string): RawPart {
  const headerEnd = raw.search(/\r?\n\r?\n/);
  if (headerEnd < 0) return { headers: {}, body: raw };
  const headerSection = raw.slice(0, headerEnd);
  const body = raw.slice(headerEnd).replace(/^\r?\n\r?\n/, '');
  const unfolded = headerSection.replace(/\r?\n[ \t]+/g, ' ');
  const headers: Record<string, string> = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const name = line.slice(0, idx).trim().toLowerCase();
    headers[name] = line.slice(idx + 1).trim();
  }
  return { headers, body };
}

function collectParts(raw: string, out: ParsedMessage): void {
  const part = splitHeadersAndBody(raw);
  const ct = part.headers['content-type'] ?? 'text/plain';
  const ctMain = ct.split(';')[0].trim().toLowerCase();

  if (ctMain.startsWith('multipart/')) {
    const boundary = paramFromHeader(ct, 'boundary');
    if (!boundary) return;
    for (const child of splitByBoundary(part.body, boundary)) {
      collectParts(child, out);
    }
    return;
  }

  const cd = part.headers['content-disposition'] ?? '';
  const cte = (part.headers['content-transfer-encoding'] ?? '7bit').toLowerCase();
  const filename = paramFromHeader(cd, 'filename') ?? paramFromHeader(ct, 'name');
  const isAttachment = /attachment/i.test(cd) || (filename != null && !ctMain.startsWith('text/'));

  if (isAttachment) {
    out.attachments.push({
      name: filename ?? 'attachment',
      type: ctMain,
      data: decodeToBytes(part.body, cte),
    });
    return;
  }

  const text = decodeToString(part.body, cte);
  if (ctMain === 'text/html' && out.htmlBody == null) {
    out.htmlBody = text;
  } else if (ctMain === 'text/plain' && out.plainBody == null) {
    out.plainBody = text;
  } else if (out.htmlBody == null && out.plainBody == null) {
    // Text-ish but an unfamiliar type. Surfacing it as plain beats dropping it.
    out.plainBody = text;
  }
}

function paramFromHeader(value: string, name: string): string | null {
  const re = new RegExp(`(?:^|;)\\s*${name}\\s*=\\s*"?([^";]+)"?`, 'i');
  const m = value.match(re);
  return m ? m[1].trim() : null;
}

function splitByBoundary(body: string, boundary: string): string[] {
  const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Boundaries sit on their own line as --boundary, with --boundary-- closing
  // the set. Split on either, then drop the preamble before the first boundary
  // and the epilogue after the close, neither of which is a part.
  const re = new RegExp(`(?:^|\\r?\\n)--${escaped}(?:--)?[^\\n]*\\r?\\n?`, 'g');
  const pieces = body.split(re);
  return pieces.slice(1).filter((p) => p.length > 0);
}

function decodeToBytes(body: string, encoding: string): Uint8Array {
  if (encoding === 'base64') {
    const cleaned = body.replace(/\s/g, '');
    try {
      const bin = atob(cleaned);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch {
      // Truncated or corrupt base64. An empty attachment is recoverable for
      // the caller; a throw here would lose the rest of the message too.
      return new Uint8Array();
    }
  }
  if (encoding === 'quoted-printable') {
    return decodeQuotedPrintable(body);
  }
  return new TextEncoder().encode(body);
}

function decodeToString(body: string, encoding: string): string {
  if (encoding === 'base64') {
    const cleaned = body.replace(/\s/g, '');
    try {
      const bin = atob(cleaned);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return body;
    }
  }
  if (encoding === 'quoted-printable') {
    return new TextDecoder('utf-8').decode(decodeQuotedPrintable(body));
  }
  return body;
}

/** Decode quoted-printable to BYTES, not to a string.
 *
 *  Each `=XX` is one octet, and a non-ASCII character is sent as a *sequence*
 *  of them — `café` is `caf=C3=A9`. Mapping each octet through
 *  `String.fromCharCode` yields one character per byte, so that reads back as
 *  `cafÃ©`: every accented character in a quoted-printable body came out
 *  mojibake, and the byte path then re-encoded that as UTF-8 and doubled it.
 *  Collecting octets and decoding once at the end is the only way to get the
 *  multi-byte sequences back.
 *
 *  Carried over from apps/outlook-addon with the bug fixed (#129); the
 *  round-trip test in tests/parse.test.ts is what caught it. */
function decodeQuotedPrintable(s: string): Uint8Array {
  // Soft line breaks first: they are `=` at end of line and encode nothing.
  const unfolded = s.replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < unfolded.length; i++) {
    const ch = unfolded[i];
    if (ch === '=' && /^[0-9A-F]{2}$/i.test(unfolded.slice(i + 1, i + 3))) {
      out.push(parseInt(unfolded.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 0x80) {
      out.push(code);
    } else {
      // Not legal quoted-printable — a lenient sender left raw UTF-8 in the
      // body. Keep it rather than mangling it to a single byte.
      for (const b of new TextEncoder().encode(ch)) out.push(b);
    }
  }
  return new Uint8Array(out);
}
