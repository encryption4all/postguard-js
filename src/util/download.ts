/** Trigger a browser file download from a Blob */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Trigger a browser download for each file in the list */
export function triggerBrowserDownloads(files: Array<{ name: string; blob: Blob }>): void {
  for (const { name, blob } of files) {
    triggerBrowserDownload(blob, name);
  }
}
