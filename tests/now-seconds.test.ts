// The seal policy timestamp must never be in the future: the PKG rejects a USK
// request whose timestamp is > now ("chronology error"), so an immediate
// encrypt→decrypt could fail if the timestamp were rounded up. nowSeconds()
// uses floor for exactly this reason.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nowSeconds } from '../src/util/policy.js';

describe('nowSeconds', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('floors — never rounds a sub-second past 0.5 up to the next second', () => {
    // 1000.700s: Math.round would give 1001 (one second in the future).
    vi.setSystemTime(new Date(1000_700));
    expect(nowSeconds()).toBe(1000);
  });

  it('is exact on a whole second', () => {
    vi.setSystemTime(new Date(1000_000));
    expect(nowSeconds()).toBe(1000);
  });

  it('never exceeds Date.now()/1000 (would trip the PKG chronology check)', () => {
    for (const ms of [1234_001, 1234_499, 1234_500, 1234_999]) {
      vi.setSystemTime(new Date(ms));
      expect(nowSeconds()).toBeLessThanOrEqual(Date.now() / 1000);
    }
  });
});
