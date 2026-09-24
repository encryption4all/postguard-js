/**
 * `renovate.json` at the repo root (postguard-js#280, decisions settled in
 * encryption4all/postguard#254). `renovate-config-validator --strict` catches a
 * malformed file — run by hand for now; no CI job in this repo wires it in yet.
 * It does not catch a well-formed file that says the wrong thing. This is the
 * check for that second failure mode, and it exists because of
 * encryption4all/postguard#419: a rule telling Renovate to leave something
 * alone needs a check that fails when the rule is removed, or the removal is
 * silent until the bot acts on it weeks later.
 *
 * Three things this file must keep true, each with its own assertion below
 * rather than one combined one, so a regression names which promise broke:
 *
 * - It extends `github>encryption4all/renovate-config`, the fleet preset. That
 *   preset is where the weekly grouping, the major-update dashboard gate, the
 *   security-alert exemption and the fleet-wide `@e4a/*` disable all live —
 *   this repo does not restate them, so dropping the `extends` entry silently
 *   loses all of them at once.
 * - `apps/**` and `examples/**` get `rangeStrategy: "bump"`, because they
 *   consume `@e4a/pg-js` rather than publish to npm: a routine bump there may
 *   need to raise the version they require, where the preset's default
 *   `update-lockfile` would only widen what a lockfile pins. `packages/**`
 *   (the published SDK) stays on that default by not being matched here.
 * - No rule anywhere in this file re-enables an `@e4a/*` package, and no rule
 *   sets `automerge: true` — both walk the whole parsed tree, not just the
 *   top level or `packageRules`, since either could be smuggled in at any
 *   depth a future edit adds.
 */

import { readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

/** Repo root, found by walking up to the directory that holds the workspace file. */
const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      if (statSync(join(dir, 'pnpm-workspace.yaml')).isFile()) return dir;
    } catch {
      // keep walking
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`no pnpm-workspace.yaml above ${fileURLToPath(import.meta.url)}`);
})();

const config: Record<string, unknown> = JSON.parse(
  readFileSync(join(repoRoot, 'renovate.json'), 'utf8')
);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Every plain object anywhere in the parsed config, so a rule nested somewhere
 * other than the top-level `packageRules` array is still caught.
 */
const allObjects = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.flatMap(allObjects);
  if (!isPlainObject(value)) return [];
  return [value, ...Object.values(value).flatMap(allObjects)];
};

describe('renovate.json', () => {
  it('extends the fleet preset', () => {
    expect(
      Array.isArray(config.extends) && config.extends.length > 0,
      'renovate.json has no extends array at all'
    ).toBe(true);
    expect(
      config.extends,
      'renovate.json no longer extends github>encryption4all/renovate-config, so the weekly ' +
        'grouping, the major-update dashboard gate, the security-alert exemption and the ' +
        'fleet-wide @e4a/* disable it supplies are all silently gone from this repo'
    ).toContain('github>encryption4all/renovate-config');
  });

  it('routes apps/** and examples/** to rangeStrategy: bump', () => {
    const rules = Array.isArray(config.packageRules)
      ? (config.packageRules as Record<string, unknown>[])
      : [];
    const rule = rules.find((candidate) => {
      const files = candidate.matchFileNames;
      return Array.isArray(files) && files.includes('apps/**') && files.includes('examples/**');
    });
    expect(
      rule,
      'no packageRule matches both apps/** and examples/** by matchFileNames. Those paths ' +
        'consume @e4a/pg-js rather than publish to npm, so without this rule a routine bump ' +
        "there falls back to the preset's update-lockfile strategy and never raises the " +
        'version they actually require'
    ).toBeDefined();
    expect(
      rule?.rangeStrategy,
      'the apps/**+examples/** rule no longer sets rangeStrategy: "bump"'
    ).toBe('bump');
  });

  it('re-enables no @e4a/* package', () => {
    for (const candidate of allObjects(config)) {
      if (candidate.enabled !== true) continue;
      const names = candidate.matchPackageNames;
      if (!Array.isArray(names)) continue;
      expect(
        names.some((name) => typeof name === 'string' && name.startsWith('@e4a/')),
        `a rule enables an @e4a/* package: ${JSON.stringify(candidate)}. The fleet preset ` +
          'disables every @e4a/* package on purpose — some are wire-compatibility readers or ' +
          'fixtures that must age, and a bump there silently undoes a compat gate'
      ).toBe(false);
    }
  });

  it('sets automerge nowhere', () => {
    for (const candidate of allObjects(config)) {
      expect(
        candidate.automerge,
        `found automerge: true in ${JSON.stringify(candidate)}. Both postguard and postguard-js ` +
          'require one review, which a bot cannot give, so an automerged PR here would merge ' +
          'unreviewed'
      ).not.toBe(true);
    }
  });
});
