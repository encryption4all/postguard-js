// Office.js-specific MIME glue.
//
// The MIME parsing, header reading, PostGuard detection and archival armor
// readers that used to live here now come from `@e4a/pg-js`, so Thunderbird
// and Outlook read the same shape by construction rather than by two hand-
// rolled parsers agreeing (encryption4all/postguard-js#129). Import them from
// the SDK directly:
//
//   import {
//     POSTGUARD_ENCRYPTED_FILENAME, detectPostGuard, parseDecryptedMime,
//     readMimeHeader, extractArmoredCiphertext, looksLikeArmoredPostGuard,
//   } from "@e4a/pg-js";
//
// What is left is genuinely host-specific: it exists because of a limitation
// in Office.js, not because of anything about PostGuard.

// Best-effort MIME type from a filename extension.
//
// Office.js hands back an attachment name and no Content-Type, so the type has
// to be reconstructed before the bytes can go into a MIME part. The map is
// deliberately short: anything unlisted falls back to application/octet-stream,
// which both pg-js and recipient mail clients handle correctly. This does not
// belong in the SDK — no other host needs it, because no other host has the
// gap it works around.
export function guessContentType(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    html: "text/html",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    zip: "application/zip",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext] ?? "application/octet-stream";
}
