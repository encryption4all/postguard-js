/**
 * The repo root's `CLAUDE.md` is orientation, and nothing may refill it
 * (encryption4all/dobby-code#677, built on #653/#482).
 *
 * It was 29,921 B at `7767706`, the revision this cut was written against, and it
 * got there by accretion: an SDK reference, a CI reference and a block of "agent
 * notes (migrated from the dobby memory repo)" all landed in one file because
 * every prompt that told a container to write down what it learned pointed here.
 * That producer is retired fleet-wide, and durable knowledge is a binding rule the
 * host delivers per task at `~/dobby-rules.md`, or a header comment beside the
 * check it explains — the way this file's own header is.
 *
 * The cap is not cosmetic. Under 4,000 B the container working this repo gets its
 * cwd pointed at the clone, so the file auto-loads and every task gets the
 * orientation; over it, the repo runs with the checkout as a sibling directory and
 * the file is the thing most tasks never read. dobby-code#440 cut its own copy
 * once without a gate and it doubled again in 17 days, which is why this file
 * exists rather than a note asking politely.
 *
 * ## Where this lives, and what it therefore covers
 *
 * In `packages/pg-js`, for the reason `ci-wiring.test.ts` sets out at length: this
 * suite runs in three lanes of `integration.yml` (`Node 22`/`Node 24` via
 * `pnpm -r test`, `Bun 1.3.14`, `Deno 2.8.0`), and no workflow in this repo is
 * path-filtered. So unlike dobby-code's own gate — path-filtered to `webhook/**`,
 * and blind to a PR touching only `CLAUDE.md` — this one reports on every PR,
 * including a PR whose whole diff is the file it guards.
 *
 * Scope worth naming: this covers the ROOT file, the one the cwd gate reads.
 * `apps/*` and `examples/` keep their own `CLAUDE.md` files and they are not cut
 * and not capped here.
 */

import { readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

/**
 * 4,000 B against an orientation file that lands near 3,100 B: room to add a part
 * or a cross-repo edge, not room for a second corpus. Raising it should be a
 * decision rather than a reflex, and the number is the one dobby-code#482's cwd
 * gate reads — raising it here does not move that gate, it only hides the fact
 * that the file no longer clears it.
 */
const MAX_BYTES = 4_000;

/**
 * The reference sections the cut removed. Named rather than left to the byte
 * count, because the byte count says only "too big" while the failure this guards
 * is specifically the reference material coming back: any one of these returning
 * is the same file starting over.
 *
 * Eleven of the fourteen `##` sections at `7767706`. `Project overview`, `Overview`
 * and ``Examples (`examples/*`)`` are deliberately absent: an orientation file may
 * legitimately want a heading by those names, so only the byte cap holds them.
 *
 * Matched at any heading level, since a corpus section demoted to `###` is the
 * same corpus. `Tests` is on the list on purpose — "how to run the suite" is
 * `README.md`'s job and the SDK's own docs', and it was the seed of the command
 * table the cut removed.
 */
const DELETED_SECTIONS = [
  'Common commands',
  'Architecture',
  'Tests',
  'Supported runtimes',
  'Releases and CI',
  'Agent notes (migrated from the dobby memory repo)',
  'Build pipeline (gitignored generated sources)',
  'Repo layout',
  'Package scripts',
  'Signing keys / Yivi sessions',
  'Client-side JWT trust boundary',
];

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

const claudeMd = join(repoRoot, 'CLAUDE.md');

describe('the root CLAUDE.md', () => {
  it('stays orientation-sized', () => {
    const bytes = statSync(claudeMd).size;
    expect(
      bytes,
      `CLAUDE.md is ${bytes} B, over the ${MAX_BYTES} B cap. This file is ORIENTATION — what this ` +
        `repo is, its parts, which repos a change here touches, and where the operational knowledge ` +
        `lives. Durable knowledge belongs in a binding rule (at most 600 B, delivered to the next ` +
        `container at ~/dobby-rules.md) or in a comment beside the check it explains, not here. ` +
        `Above the cap a container working this repo loses its cwd on the clone, and the file stops ` +
        `being loaded at all. See encryption4all/dobby-code#677.`,
    ).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('has no heading from the deleted reference corpus', () => {
    // Fenced blocks are stripped first: a `# comment` line in a shell sample is not
    // a heading, and matching one would fail this test naming the wrong cause.
    const body = readFileSync(claudeMd, 'utf8').replace(/^```[\s\S]*?^```/gm, '');
    // The trailing `#+` is closed-ATX (`## Tests ##`), which would otherwise capture
    // `Tests ##` and slip past the list.
    const headings = [...body.matchAll(/^#{1,6} +(.+?)(?:\s+#+)?\s*$/gm)].map(([, h]) => h);
    for (const section of DELETED_SECTIONS) {
      expect(
        headings,
        `CLAUDE.md has a "${section}" heading again. That section went with the reference corpus; ` +
          `its content is a binding rule, a header comment on the check it describes, or README.md — ` +
          `not this file.`,
      ).not.toContain(section);
    }
  });

  it('still names the revision that carries the cut corpus', () => {
    const body = readFileSync(claudeMd, 'utf8');
    // The corpus was not migrated anywhere: `git show <sha>:CLAUDE.md` is the only
    // way back to it, so losing the sha loses the reference material for good.
    expect(
      body,
      'CLAUDE.md no longer names a revision holding the cut corpus. The old file was not migrated ' +
        'and not reconstructed — it stays in git history, and this file is what points at it. Keep a ' +
        '`git show <sha>:CLAUDE.md` pointer.',
    ).toMatch(/git show [0-9a-f]{7,40}:CLAUDE\.md/);
  });
});
