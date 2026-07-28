import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

import {
  BUMP_RANK,
  buildModel,
  classify,
  parseReport,
  pendingBump,
  renderReport,
} from '../scripts/lib/api-surface.mjs';

import * as pgjs from '../src/index.js';

/** Round-trip a declaration snippet through the report, the way CI does. */
const model = (dts: string) => parseReport(renderReport(dts));

const levelOf = (base: string, head: string) => classify(model(base), model(head)).level;

const detailsOf = (base: string, head: string) =>
  classify(model(base), model(head)).changes.map((c) => c.detail);

describe('renderReport', () => {
  it('round-trips through parseReport', () => {
    const dts = `
      interface Options { a?: string; }
      declare function go(o: Options): void;
      export { type Options, go };
    `;
    const report = renderReport(dts);
    expect(parseReport(report)).toEqual(buildModel(dts));
  });

  it('is stable against member reordering and private members', () => {
    const before = `
      declare class C {
        private secret;
        b(): void;
        a(): void;
      }
      export { C };
    `;
    const after = `
      declare class C {
        a(): void;
        b(): void;
        private otherSecret;
      }
      export { C };
    `;
    expect(renderReport(after)).toBe(renderReport(before));
  });

  it('keeps declarations that are reachable but not re-exported', () => {
    const dts = `
      declare class Base { helper(): void; }
      declare class Derived extends Base { }
      export { Derived };
    `;
    expect([...model(dts).declarations.keys()]).toEqual(['Base', 'Derived']);
  });
});

describe('classify', () => {
  it('reports no change for an identical surface', () => {
    const dts = `interface A { x: string; }\nexport { type A };`;
    expect(classify(model(dts), model(dts))).toEqual({ level: 'none', changes: [] });
  });

  it('treats a removed declaration as major', () => {
    const base = `interface A { x: string; }\ninterface B { y: string; }\nexport { type A, type B };`;
    const head = `interface A { x: string; }\nexport { type A };`;
    expect(levelOf(base, head)).toBe('major');
    expect(detailsOf(base, head)).toContain('interface `B` was removed');
  });

  it('treats an un-exported but still declared type as major', () => {
    const base = `interface A { x: string; }\ninterface B { y: string; }\nexport { type A, type B };`;
    const head = `interface A { x: B; }\ninterface B { y: string; }\nexport { type A };`;
    expect(detailsOf(base, head)).toContain('`B` is no longer exported');
    expect(levelOf(base, head)).toBe('major');
  });

  it('treats a removed member as major', () => {
    const base = `interface A { x: string; y: number; }\nexport { type A };`;
    const head = `interface A { x: string; }\nexport { type A };`;
    expect(detailsOf(base, head)).toEqual(['`A.y` was removed']);
  });

  it('treats a changed member type as major', () => {
    const base = `interface A { x: string; }\nexport { type A };`;
    const head = `interface A { x: number; }\nexport { type A };`;
    expect(detailsOf(base, head)).toEqual(['`A.x` changed signature']);
  });

  it('treats a new optional member as minor', () => {
    const base = `interface A { x: string; }\nexport { type A };`;
    const head = `interface A { x: string; y?: number; }\nexport { type A };`;
    expect(levelOf(base, head)).toBe('minor');
  });

  it('treats a new required member as major', () => {
    const base = `interface A { x: string; }\nexport { type A };`;
    const head = `interface A { x: string; y: number; }\nexport { type A };`;
    expect(detailsOf(base, head)).toEqual(['`A.y` was added as a required member']);
  });

  it('treats a new export as minor', () => {
    const base = `interface A { x: string; }\nexport { type A };`;
    const head = `interface A { x: string; }\ninterface B { y: string; }\nexport { type A, type B };`;
    expect(levelOf(base, head)).toBe('minor');
    expect(detailsOf(base, head)).toEqual(['interface `B` was added']);
  });

  it('treats a changed base class as major', () => {
    const base = `declare class Other { }\ndeclare class C { a(): void; }\nexport { C, Other };`;
    const head = `declare class Other { }\ndeclare class C extends Other { a(): void; }\nexport { C, Other };`;
    expect(levelOf(base, head)).toBe('major');
  });

  it('treats a kind change as major', () => {
    const base = `interface A { x: string; }\nexport { type A };`;
    const head = `type A = { x: string };\nexport { type A };`;
    expect(detailsOf(base, head)).toEqual(['`A` changed from interface to type']);
  });

  it('treats a changed type alias as major', () => {
    const base = `type A = 'a' | 'b';\nexport { type A };`;
    const head = `type A = 'a' | 'b' | 'c';\nexport { type A };`;
    expect(levelOf(base, head)).toBe('major');
  });

  describe('function signatures', () => {
    it('allows a trailing optional parameter as minor', () => {
      const base = `declare function go(a: string): void;\nexport { go };`;
      const head = `declare function go(a: string, b?: number): void;\nexport { go };`;
      expect(detailsOf(base, head)).toEqual(['`go` gained an optional parameter']);
    });

    it('allows a trailing rest parameter as minor', () => {
      const base = `declare function go(a: string): void;\nexport { go };`;
      const head = `declare function go(a: string, ...rest: number[]): void;\nexport { go };`;
      expect(levelOf(base, head)).toBe('minor');
    });

    it('treats a trailing required parameter as major', () => {
      const base = `declare function go(a: string): void;\nexport { go };`;
      const head = `declare function go(a: string, b: number): void;\nexport { go };`;
      expect(detailsOf(base, head)).toEqual(['`go` changed signature']);
    });

    it('treats a changed parameter type as major', () => {
      const base = `declare function go(a: string, b?: number): void;\nexport { go };`;
      const head = `declare function go(a: number, b?: number): void;\nexport { go };`;
      expect(levelOf(base, head)).toBe('major');
    });

    it('treats a changed return type as major', () => {
      const base = `declare function go(a: string): void;\nexport { go };`;
      const head = `declare function go(a: string, b?: number): string;\nexport { go };`;
      expect(levelOf(base, head)).toBe('major');
    });

    it('treats a removed parameter as major', () => {
      const base = `declare function go(a: string, b?: number): void;\nexport { go };`;
      const head = `declare function go(a: string): void;\nexport { go };`;
      expect(levelOf(base, head)).toBe('major');
    });

    it('applies the same rule to methods', () => {
      const base = `declare class C { go(a: string): void; }\nexport { C };`;
      const head = `declare class C { go(a: string, b?: number): void; }\nexport { C };`;
      expect(detailsOf(base, head)).toEqual(['`C.go` gained an optional parameter']);
    });

    it('treats a dropped overload as major', () => {
      const base = `declare function go(a: string): void;\ndeclare function go(a: number): void;\nexport { go };`;
      const head = `declare function go(a: string): void;\nexport { go };`;
      expect(levelOf(base, head)).toBe('major');
    });
  });

  it('reports the highest level when several things changed', () => {
    const base = `interface A { x: string; }\nexport { type A };`;
    const head = `interface A { y: string; }\ninterface B { z: string; }\nexport { type A, type B };`;
    const { level, changes } = classify(model(base), model(head));
    expect(level).toBe('major');
    expect(changes).toHaveLength(3);
  });
});

describe('pendingBump', () => {
  const changeset = (bump: string, name = '@e4a/pg-js') =>
    `---\n'${name}': ${bump}\n---\n\nSomething changed.\n`;

  it('returns none without changesets', () => {
    expect(pendingBump([], '@e4a/pg-js')).toBe('none');
  });

  it('reads a single-quoted package name', () => {
    expect(pendingBump([{ name: 'a.md', content: changeset('minor') }], '@e4a/pg-js')).toBe('minor');
  });

  it('reads a double-quoted package name', () => {
    const content = `---\n"@e4a/pg-js": major\n---\n\nBreaking.\n`;
    expect(pendingBump([{ name: 'a.md', content }], '@e4a/pg-js')).toBe('major');
  });

  it('reads an unquoted package name', () => {
    const content = `---\n@e4a/pg-js: patch\n---\n\nFix.\n`;
    expect(pendingBump([{ name: 'a.md', content }], '@e4a/pg-js')).toBe('patch');
  });

  it('takes the highest bump across files', () => {
    const files = [
      { name: 'a.md', content: changeset('patch') },
      { name: 'b.md', content: changeset('major') },
      { name: 'c.md', content: changeset('minor') },
    ];
    expect(pendingBump(files, '@e4a/pg-js')).toBe('major');
  });

  it('ignores changesets for other packages', () => {
    expect(pendingBump([{ name: 'a.md', content: changeset('major', '@e4a/other') }], '@e4a/pg-js')).toBe(
      'none'
    );
  });

  it('ignores a bump word in the changeset body', () => {
    const content = `---\n'@e4a/pg-js': patch\n---\n\nThis is not a major change.\n`;
    expect(pendingBump([{ name: 'a.md', content }], '@e4a/pg-js')).toBe('patch');
  });

  it('orders bumps so a smaller one fails the gate', () => {
    expect(BUMP_RANK.patch).toBeLessThan(BUMP_RANK.minor);
    expect(BUMP_RANK.minor).toBeLessThan(BUMP_RANK.major);
    expect(BUMP_RANK.none).toBeLessThan(BUMP_RANK.patch);
  });
});

describe('the committed report', () => {
  const report = readFileSync(fileURLToPath(new URL('../etc/pg-js.api.md', import.meta.url)), 'utf8');

  it('lists every runtime export of the package', () => {
    const listed = new Set(parseReport(report).exports.map((e) => e.name));
    const missing = Object.keys(pgjs).filter((name) => !listed.has(name));
    expect(missing).toEqual([]);
  });
});
