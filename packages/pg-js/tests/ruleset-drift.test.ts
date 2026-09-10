/**
 * Offline self-test of `compareRules` (postguard-js#274). No network, no
 * `fetch`, no live API — every fixture below is hand-written, shaped like the
 * parsed JSON `GET /repos/{owner}/{repo}/rules/branches/main` returns. This is
 * what runs under `pnpm -r test` and reports as `Integration complete`: the
 * checker's CORRECTNESS blocks a merge, while its LIVE read only files an
 * issue — see scripts/ruleset-drift.mjs's header for that split.
 */

import { describe, expect, it } from 'vitest';

import { compareRules } from '../scripts/lib/ruleset-drift.mjs';

const EXPECTED = {
  contexts: ['Lint', 'Unit Tests', 'Unit tests'],
  requiredApprovingReviewCount: 1,
};

/** A live ruleset shaped like the real API response, review count overridable. */
const liveRules = (contexts: string[], requiredApprovingReviewCount = 1) => [
  {
    type: 'required_status_checks',
    parameters: {
      required_status_checks: contexts.map((context) => ({ context, integration_id: 15368 })),
    },
  },
  {
    type: 'pull_request',
    parameters: { required_approving_review_count: requiredApprovingReviewCount },
  },
];

describe('compareRules', () => {
  it('reports no drift on an exact match', () => {
    const { code } = compareRules(EXPECTED, liveRules(EXPECTED.contexts));
    expect(code).toBe(0);
  });

  it('reports drift and names a missing context', () => {
    const { code, report } = compareRules(EXPECTED, liveRules(['Lint', 'Unit Tests']));
    expect(code).toBe(1);
    expect(report).toContain('Unit tests');
  });

  it('reports drift and names an unexpected extra context', () => {
    const { code, report } = compareRules(
      EXPECTED,
      liveRules([...EXPECTED.contexts, 'Some New Job'])
    );
    expect(code).toBe(1);
    expect(report).toContain('Some New Job');
  });

  it('reports drift when the review count is 0', () => {
    const { code, report } = compareRules(EXPECTED, liveRules(EXPECTED.contexts, 0));
    expect(code).toBe(1);
    expect(report).toMatch(/review count is 0/);
  });

  it('reports no drift when the review count is higher than the floor', () => {
    const { code } = compareRules(EXPECTED, liveRules(EXPECTED.contexts, 2));
    expect(code).toBe(0);
  });

  it('reports drift when the pull_request rule is missing entirely', () => {
    const withoutReviewRule = liveRules(EXPECTED.contexts).filter(
      (rule) => rule.type !== 'pull_request'
    );
    const { code, report } = compareRules(EXPECTED, withoutReviewRule);
    expect(code).toBe(1);
    expect(report).toMatch(/review count is 0/);
  });

  it('is undetermined, not drift, on a non-array response', () => {
    const { code, report } = compareRules(EXPECTED, { message: 'Not Found' });
    expect(code).toBe(2);
    expect(report).not.toMatch(/have drifted/i);
    expect(report).toContain('expected an array');
  });

  it('is undetermined, not drift, on an empty response', () => {
    const { code, report } = compareRules(EXPECTED, []);
    expect(code).toBe(2);
    expect(report).not.toMatch(/have drifted/i);
    expect(report).toContain('was empty');
  });
});
