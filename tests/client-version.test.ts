import { describe, it, expect } from 'vitest';
import {
  PG_CLIENT_VERSION_HEADER,
  defaultClientVersionHeaderValue,
} from '../src/util/client-version.js';

describe('defaultClientVersionHeaderValue', () => {
  it('uses the canonical header name', () => {
    expect(PG_CLIENT_VERSION_HEADER).toBe('X-POSTGUARD-CLIENT-VERSION');
  });

  it('produces exactly four comma-separated fields', () => {
    const fields = defaultClientVersionHeaderValue().split(',');
    expect(fields).toHaveLength(4);
  });

  it('reports app=pg-js with a version', () => {
    const [, , app, appVersion] = defaultClientVersionHeaderValue().split(',');
    expect(app).toBe('pg-js');
    // Under the pretest-generated version.ts the placeholder maps to the dev
    // sentinel; a released build embeds the real version instead.
    expect(appVersion).toBe('0.0.0-dev');
  });

  it('detects the Node runtime as host when running under vitest/node', () => {
    const [host, hostVersion] = defaultClientVersionHeaderValue().split(',');
    expect(host).toBe('node');
    expect(hostVersion).toBe(process.versions.node);
  });

  it('never emits more than four fields even if a field contained a comma', () => {
    // The value is comma-delimited; a comma inside a detected field would
    // otherwise produce a 5th field and break the wire contract. Stub a Bun
    // global whose version contains a comma to exercise the sanitiser.
    const g = globalThis as any;
    const prior = g.Bun;
    g.Bun = { version: '1.2,3' };
    try {
      const fields = defaultClientVersionHeaderValue().split(',');
      expect(fields).toHaveLength(4);
      expect(fields[0]).toBe('bun');
      expect(fields[1]).toBe('1.2.3'); // comma replaced with '.'
    } finally {
      if (prior === undefined) delete g.Bun;
      else g.Bun = prior;
    }
  });
});
