import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sortPolicies,
  secondsTill4AM,
  buildKeyRequest,
  JWT_CACHE_MAX_SIZE,
  MAX_CACHE_TTL_SECONDS,
  __testing as jwtCacheInternals,
} from '../src/yivi/decrypt-session.js';

// Build a minimal JWT (header.payload.sig) with a given `exp` claim (seconds).
function makeJwt(exp: number, jti = ''): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp, jti })).toString('base64url');
  return `${header}.${payload}.sig`;
}

const POLICY = [{ t: 'pbdf.sidn-pbdf.email.email', v: 'a@b.com' }];

describe('sortPolicies', () => {
  it('sorts by type alphabetically', () => {
    const input = [
      { t: 'pbdf.sidn-pbdf.email.email', v: 'a@b.com' },
      { t: 'pbdf.sidn-pbdf.email.domain', v: 'b.com' },
    ];
    const sorted = sortPolicies(input);
    expect(sorted[0].t).toBe('pbdf.sidn-pbdf.email.domain');
    expect(sorted[1].t).toBe('pbdf.sidn-pbdf.email.email');
  });

  it('does not mutate the original', () => {
    const input = [{ t: 'z' }, { t: 'a' }];
    sortPolicies(input);
    expect(input[0].t).toBe('z');
  });
});

describe('secondsTill4AM', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calculates remaining seconds until 4 AM', () => {
    // Set time to midnight -> 4 hours = 14400 seconds
    vi.setSystemTime(new Date('2024-01-15T00:00:00'));
    expect(secondsTill4AM()).toBe(14400);
  });

  it('wraps to next day if past 4 AM', () => {
    // Set time to 5 AM -> 23 hours until next 4 AM = 82800 seconds
    vi.setSystemTime(new Date('2024-01-15T05:00:00'));
    expect(secondsTill4AM()).toBe(82800);
  });
});

describe('buildKeyRequest', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sets email value to the key', () => {
    vi.setSystemTime(new Date('2024-01-15T00:00:00'));
    const policy = {
      ts: 1700000000,
      con: [{ t: 'pbdf.sidn-pbdf.email.email', v: 'alice@example.com' }],
    };
    const req = buildKeyRequest('bob@example.com', policy);

    expect(req.con[0].v).toBe('bob@example.com');
    expect(req.validity).toBe(14400);
  });

  it('infers domain from key for domain attributes', () => {
    vi.setSystemTime(new Date('2024-01-15T00:00:00'));
    const policy = {
      ts: 1700000000,
      con: [{ t: 'pbdf.sidn-pbdf.email.domain' }],
    };
    const req = buildKeyRequest('user@corp.com', policy);

    expect(req.con[0].v).toBe('corp.com');
  });

  it('strips values from unknown attribute types', () => {
    vi.setSystemTime(new Date('2024-01-15T00:00:00'));
    const policy = {
      ts: 1700000000,
      con: [{ t: 'pbdf.some-other-attr', v: 'secret' }],
    };
    const req = buildKeyRequest('user@example.com', policy);

    expect(req.con[0].v).toBeUndefined();
  });
});

describe('jwt cache bounds', () => {
  beforeEach(() => {
    jwtCacheInternals.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    jwtCacheInternals.clear();
    vi.useRealTimers();
  });

  it('caps size at JWT_CACHE_MAX_SIZE under a stress insert', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    for (let i = 0; i < JWT_CACHE_MAX_SIZE + 50; i++) {
      jwtCacheInternals.cacheJwt(`user${i}@example.com`, POLICY, makeJwt(exp, `j${i}`));
    }
    expect(jwtCacheInternals.size()).toBe(JWT_CACHE_MAX_SIZE);
  });

  it('evicts the least-recently-used entry once the cap is hit', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    for (let i = 0; i < JWT_CACHE_MAX_SIZE; i++) {
      jwtCacheInternals.cacheJwt(`user${i}@example.com`, POLICY, makeJwt(exp, `j${i}`));
    }
    // Touch user0 so it's now the most-recently-used.
    expect(jwtCacheInternals.getCachedJwt('user0@example.com', POLICY)).not.toBeNull();
    // Insert one more; user1 (now LRU) should be evicted, user0 should survive.
    jwtCacheInternals.cacheJwt('new@example.com', POLICY, makeJwt(exp, 'new'));
    expect(jwtCacheInternals.size()).toBe(JWT_CACHE_MAX_SIZE);
    expect(jwtCacheInternals.getCachedJwt('user0@example.com', POLICY)).not.toBeNull();
    expect(jwtCacheInternals.getCachedJwt('user1@example.com', POLICY)).toBeNull();
    expect(jwtCacheInternals.getCachedJwt('new@example.com', POLICY)).not.toBeNull();
  });

  it('sweeps expired entries on write without requiring them to be queried', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    // Insert entries that will be expired by the time we write again.
    jwtCacheInternals.cacheJwt('soon@example.com', POLICY, makeJwt(nowSec + 60, 'soon'));
    jwtCacheInternals.cacheJwt('alive@example.com', POLICY, makeJwt(nowSec + 7200, 'alive'));
    expect(jwtCacheInternals.size()).toBe(2);

    // Advance past the 60s expiry (plus the 30s margin).
    vi.setSystemTime(new Date(Date.now() + 120 * 1000));

    // A write for an unrelated key should sweep the expired one even though it was never read.
    jwtCacheInternals.cacheJwt('writer@example.com', POLICY, makeJwt(nowSec + 7200, 'writer'));

    expect(jwtCacheInternals.size()).toBe(2);
    expect(jwtCacheInternals.getCachedJwt('soon@example.com', POLICY)).toBeNull();
    expect(jwtCacheInternals.getCachedJwt('alive@example.com', POLICY)).not.toBeNull();
    expect(jwtCacheInternals.getCachedJwt('writer@example.com', POLICY)).not.toBeNull();
  });

  it('returns the cached JWT within its TTL (happy path unchanged)', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const jwt = makeJwt(exp, 'hit');
    jwtCacheInternals.cacheJwt('hit@example.com', POLICY, jwt);
    expect(jwtCacheInternals.getCachedJwt('hit@example.com', POLICY)).toBe(jwt);
  });
});

describe('jwt cache exp hardening', () => {
  beforeEach(() => {
    jwtCacheInternals.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    jwtCacheInternals.clear();
    vi.useRealTimers();
  });

  it('clamps a forged far-future exp to MAX_CACHE_TTL_SECONDS', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    // A network adversary crafts a JWT claiming it expires a decade from now.
    const forgedExp = nowSec + 10 * 365 * 24 * 60 * 60;
    const jwt = makeJwt(forgedExp, 'forged');
    jwtCacheInternals.cacheJwt('victim@example.com', POLICY, jwt);

    // Still cached just inside the clamp window...
    vi.setSystemTime(new Date(Date.now() + (MAX_CACHE_TTL_SECONDS - 120) * 1000));
    expect(jwtCacheInternals.getCachedJwt('victim@example.com', POLICY)).toBe(jwt);

    // ...but expired once we pass the clamp, regardless of the forged exp.
    vi.setSystemTime(new Date(Date.now() + 300 * 1000));
    expect(jwtCacheInternals.getCachedJwt('victim@example.com', POLICY)).toBeNull();
  });

  it('honours a legitimate short exp below the clamp', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = makeJwt(nowSec + 600, 'short');
    jwtCacheInternals.cacheJwt('user@example.com', POLICY, jwt);

    // Past the real 10-minute exp (plus 30s margin) it must be gone even
    // though that's well within MAX_CACHE_TTL_SECONDS.
    vi.setSystemTime(new Date(Date.now() + 700 * 1000));
    expect(jwtCacheInternals.getCachedJwt('user@example.com', POLICY)).toBeNull();
  });

  it('does not cache a JWT with a non-numeric exp', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ exp: 'soon' })).toString('base64url');
    jwtCacheInternals.cacheJwt('bad@example.com', POLICY, `${header}.${payload}.sig`);
    expect(jwtCacheInternals.size()).toBe(0);
  });

  it('does not cache an already-expired JWT', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    jwtCacheInternals.cacheJwt('old@example.com', POLICY, makeJwt(nowSec - 10, 'old'));
    expect(jwtCacheInternals.size()).toBe(0);
  });

  it('does not cache a structurally malformed JWT', () => {
    jwtCacheInternals.cacheJwt('junk@example.com', POLICY, 'not-a-jwt');
    expect(jwtCacheInternals.size()).toBe(0);
  });
});
