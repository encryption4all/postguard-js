/** Strip directory components from a ZIP entry name. ZIP archives can
 *  legally carry names like `../../etc/passwd` or absolute paths; left
 *  unfiltered these flow straight to `<a download>` whose browser
 *  sanitization is inconsistent. Take the basename after the last
 *  forward or back slash; fall back to a placeholder if nothing
 *  remains (e.g. the entry was just `/`).
 *
 *  This is for browser-trigger UX, not arbitrary-path defense — the
 *  `<a download>` attribute is already a hint, and a malicious archive
 *  can still trip on `name === ''` if we don't substitute. */
export function sanitizeDownloadFilename(name: string): string {
  const basename = name.replace(/^.*[/\\]/, '');
  return basename || 'file';
}

/** Trigger a browser file download from a Blob. The filename is
 *  sanitized to its basename to avoid path-traversal-style ZIP names
 *  reaching the user's filesystem hints. */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeDownloadFilename(filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Trigger a browser download for each file in the list.
 *
 *  Caveat: triggering multiple downloads from a single user gesture
 *  prompts the user in Firefox/Safari, and Chrome shows a
 *  "wants to download multiple files" bar. For a single "Download
 *  everything as one ZIP" experience, callers should use
 *  `DecryptFileResult.blob` directly with `triggerBrowserDownload`. */
export function triggerBrowserDownloads(files: Array<{ name: string; blob: Blob }>): void {
  for (const { name, blob } of files) {
    triggerBrowserDownload(blob, name);
  }
}
