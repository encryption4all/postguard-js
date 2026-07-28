import { describe, it, expect } from 'vitest';
import { sanitizeDownloadFilename } from '../src/util/download.js';

describe('sanitizeDownloadFilename', () => {
  it('returns a plain basename unchanged', () => {
    expect(sanitizeDownloadFilename('report.pdf')).toBe('report.pdf');
  });

  it('strips forward-slash directory prefixes', () => {
    expect(sanitizeDownloadFilename('dir/sub/report.pdf')).toBe('report.pdf');
  });

  it('strips backslash directory prefixes (Windows-style paths)', () => {
    expect(sanitizeDownloadFilename('dir\\sub\\report.pdf')).toBe('report.pdf');
  });

  it('strips mixed separators by taking the last component after either', () => {
    expect(sanitizeDownloadFilename('a/b\\c/report.pdf')).toBe('report.pdf');
    expect(sanitizeDownloadFilename('a\\b/c\\report.pdf')).toBe('report.pdf');
  });

  it('neutralises path-traversal style names', () => {
    // ZIP archives can legally carry `../../foo`; without basename
    // stripping these would land in `<a download>` and rely on the
    // browser to sanitize.
    expect(sanitizeDownloadFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeDownloadFilename('/etc/passwd')).toBe('passwd');
  });

  it('falls back to "file" when only separators remain', () => {
    expect(sanitizeDownloadFilename('/')).toBe('file');
    expect(sanitizeDownloadFilename('//')).toBe('file');
    expect(sanitizeDownloadFilename('\\\\')).toBe('file');
  });

  it('falls back to "file" for an empty name', () => {
    expect(sanitizeDownloadFilename('')).toBe('file');
  });

  it('preserves dotfiles and unicode', () => {
    expect(sanitizeDownloadFilename('.env')).toBe('.env');
    expect(sanitizeDownloadFilename('dir/ünïcødé.txt')).toBe('ünïcødé.txt');
  });
});
