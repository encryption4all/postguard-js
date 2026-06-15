import { describe, it, expect } from 'vitest';
import {
  PG_CLIENT_VERSION_HEADER,
  defaultClientVersionHeaderValue,
  sanitizeField,
} from '../src/util/client-version.js';

describe('defaultClientVersionHeaderValue', () => {
  it('uses the canonical header name', () => {
    expect(PG_CLIENT_VERSION_HEADER).toBe('X-POSTGUARD-CLIENT-VERSION');
  });

  it('produces exactly four comma-separated fields', () => {
    expect(defaultClientVersionHeaderValue().split(',')).toHaveLength(4);
  });

  it('reports app=pg-js with a version', () => {
    const [, , app, appVersion] = defaultClientVersionHeaderValue().split(',');
    expect(app).toBe('pg-js');
    // Under the pretest-generated version.ts the placeholder maps to the dev
    // sentinel; a released build embeds the real version instead.
    expect(appVersion).toBe('0.0.0-dev');
  });

  it('detects the current JS runtime as host (whatever runs the test)', () => {
    const [host, hostVersion] = defaultClientVersionHeaderValue().split(',');
    const g = globalThis as any;
    // Mirror detectHost()'s ordering so the assertion holds on Node, Bun and
    // Deno alike (the integration matrix runs all three).
    if (typeof g.Deno !== 'undefined') {
      expect(host).toBe('deno');
    } else if (typeof g.Bun !== 'undefined') {
      expect(host).toBe('bun');
    } else {
      expect(host).toBe('node');
      expect(hostVersion).toBe(process.versions.node);
    }
    expect(['deno', 'bun', 'node', 'browser', 'unknown']).toContain(host);
  });
});

describe('sanitizeField', () => {
  it('replaces commas so a value can never add a 5th field', () => {
    expect(sanitizeField('1.2,3')).toBe('1.2.3');
  });

  it('falls back to "unknown" for empty/blank/undefined', () => {
    expect(sanitizeField('')).toBe('unknown');
    expect(sanitizeField('   ')).toBe('unknown');
    expect(sanitizeField(undefined)).toBe('unknown');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeField('  node  ')).toBe('node');
  });
});
