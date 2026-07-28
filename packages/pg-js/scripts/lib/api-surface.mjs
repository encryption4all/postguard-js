// Public API surface tracking for @e4a/pg-js.
//
// Three pure pieces, all exercised by tests/api-surface.test.ts:
//
//   buildModel(dts)         parse a rolled-up .d.ts into a comparable model
//   renderReport(dts)       render that model as etc/pg-js.api.md
//   parseReport(markdown)   read etc/pg-js.api.md back into a model
//   classify(base, head)    the smallest semver bump two models require
//   comparisonBase(git, ref) the commit a branch should be compared against
//   pendingBump(files, pkg) the largest bump the pending changesets declare
//
// The CLI wrapper that does the file and git I/O lives in ../api-report.mjs.

import ts from 'typescript';

const VIRTUAL_FILE = '/api.d.ts';

const printer = ts.createPrinter({
  removeComments: true,
  newLine: ts.NewLineKind.LineFeed,
});

/** Bump levels ordered so a numeric compare answers "is this bump enough?". */
export const BUMP_RANK = { none: 0, patch: 1, minor: 2, major: 3 };

// --- model -----------------------------------------------------------------

/**
 * Parse a rolled-up declaration file into `{ exports, declarations }`.
 *
 * Every top-level declaration counts, not only the re-exported ones: a
 * declaration reaches the rollup because something exported references it, so
 * `PostGuardBase` (the base class of `PostGuard`) is as public as `PostGuard`
 * even though it is never named in the export clause.
 *
 * A name can own more than one statement — an overload set, or a merged
 * `interface`/`namespace` pair — so `declarations` maps a name to the whole
 * group rather than to a single statement. Keeping only one would hide the rest
 * from both the report and the comparison.
 */
export function buildModel(dts) {
  const source = ts.createSourceFile(VIRTUAL_FILE, dts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const exports = [];
  const declarations = new Map();

  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      if (clause && ts.isNamedExports(clause)) {
        for (const element of clause.elements) {
          exports.push({
            name: element.name.text,
            from: element.propertyName?.text ?? element.name.text,
            isTypeOnly: statement.isTypeOnly || element.isTypeOnly,
          });
        }
      }
      continue;
    }
    const entry = buildEntry(statement, source);
    if (!entry) continue;
    const group = declarations.get(entry.name);
    if (group) mergeEntry(group, entry);
    else declarations.set(entry.name, startGroup(entry));
  }

  exports.sort((a, b) => compareNames(a.name, b.name));
  return { exports, declarations };
}

function startGroup(entry) {
  return {
    name: entry.name,
    kind: entry.kind,
    kinds: [entry.kind],
    texts: [entry.text],
    headers: [entry.header],
    members: entry.members,
    signatures: entry.signatures,
  };
}

/**
 * Fold a second statement for the same name into its group.
 *
 * Overload signatures are appended in source order, since overload order
 * decides which one TypeScript picks. Members of merged declarations union
 * together, and a member is only additive when every declaration of it is.
 */
function mergeEntry(group, entry) {
  group.kinds.push(entry.kind);
  group.kind = groupKind(group.kinds);
  group.texts.push(entry.text);
  group.headers.push(entry.header);
  group.signatures.push(...entry.signatures);
  for (const [key, member] of entry.members) {
    const existing = group.members.get(key);
    if (!existing) {
      group.members.set(key, member);
      continue;
    }
    existing.texts.push(...member.texts);
    existing.optional = existing.optional && member.optional;
    existing.signatures.push(...member.signatures);
  }
}

/** `function` for an overload set, `function+namespace` for a merged pair. */
function groupKind(kinds) {
  const unique = [...new Set(kinds)];
  return unique.length === 1 ? unique[0] : unique.sort(compareNames).join('+');
}

function buildEntry(statement, source) {
  if (ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
    if (!statement.name) return null;
    const text = print(stripAndSortMembers(statement), source);
    return {
      name: statement.name.text,
      kind: ts.isClassDeclaration(statement) ? 'class' : 'interface',
      text,
      header: text.split('\n')[0],
      members: collectMembers(statement, source),
      signatures: [],
    };
  }
  if (ts.isFunctionDeclaration(statement)) {
    if (!statement.name) return null;
    return {
      name: statement.name.text,
      kind: 'function',
      text: print(statement, source),
      header: '',
      members: new Map(),
      signatures: [describeSignature(statement, source)],
    };
  }
  if (ts.isTypeAliasDeclaration(statement)) {
    return {
      name: statement.name.text,
      kind: 'type',
      text: print(statement, source),
      header: '',
      members: new Map(),
      signatures: [],
    };
  }
  if (ts.isEnumDeclaration(statement)) {
    return {
      name: statement.name.text,
      kind: 'enum',
      text: print(statement, source),
      header: '',
      members: new Map(),
      signatures: [],
    };
  }
  if (ts.isVariableStatement(statement)) {
    const names = statement.declarationList.declarations.map((d) => d.name.getText(source));
    return {
      name: names.join(', '),
      kind: 'variable',
      text: print(statement, source),
      header: '',
      members: new Map(),
      signatures: [],
    };
  }
  if (ts.isModuleDeclaration(statement)) {
    return {
      name: statement.name.getText(source),
      kind: 'namespace',
      text: print(statement, source),
      header: '',
      members: new Map(),
      signatures: [],
    };
  }
  return null;
}

/**
 * Drop `private` members and sort what is left by key.
 *
 * A `private` field is invisible to consumers, and member order carries no
 * meaning, so neither should show up as a report diff and demand a version
 * bump. Overloads keep their relative order, since the sort is stable.
 */
function stripAndSortMembers(declaration) {
  const kept = declaration.members
    .filter((member) => !isPrivate(member))
    .map((member, index) => ({ member, index, key: memberKey(member) }))
    .sort((a, b) => sortRank(a.key) - sortRank(b.key) || compareNames(a.key, b.key) || a.index - b.index)
    .map((entry) => entry.member);

  return ts.isClassDeclaration(declaration)
    ? ts.factory.updateClassDeclaration(
        declaration,
        declaration.modifiers,
        declaration.name,
        declaration.typeParameters,
        declaration.heritageClauses,
        kept
      )
    : ts.factory.updateInterfaceDeclaration(
        declaration,
        declaration.modifiers,
        declaration.name,
        declaration.typeParameters,
        declaration.heritageClauses,
        kept
      );
}

/** Keeps constructors and the unnamed signatures at the top, as hand-written code does. */
function sortRank(key) {
  return key === 'new()' ? 0 : key === '()' ? 1 : key === '[index]' ? 2 : 3;
}

function isPrivate(member) {
  if (member.name && ts.isPrivateIdentifier(member.name)) return true;
  return (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Private) !== 0;
}

function memberKey(member) {
  const isStatic = (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) !== 0;
  const prefix = isStatic ? 'static ' : '';
  if (ts.isConstructorDeclaration(member) || ts.isConstructSignatureDeclaration(member)) return 'new()';
  if (ts.isIndexSignatureDeclaration(member)) return '[index]';
  if (ts.isCallSignatureDeclaration(member)) return '()';
  if (!member.name) return prefix + '<unnamed>';
  return prefix + member.name.getText(member.getSourceFile());
}

function collectMembers(declaration, source) {
  const members = new Map();
  for (const member of declaration.members) {
    if (isPrivate(member)) continue;
    const key = memberKey(member);
    const existing = members.get(key) ?? { key, texts: [], optional: true, signatures: [] };
    existing.texts.push(print(member, source));
    // A member is only safe to add if every declaration of it is optional.
    existing.optional = existing.optional && member.questionToken != null;
    if (isSignatureLike(member)) existing.signatures.push(describeSignature(member, source));
    members.set(key, existing);
  }
  return members;
}

function isSignatureLike(node) {
  return (
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isConstructSignatureDeclaration(node) ||
    ts.isCallSignatureDeclaration(node)
  );
}

function describeSignature(node, source) {
  return {
    typeParameters: (node.typeParameters ?? []).map((p) => print(p, source)).join(', '),
    parameters: (node.parameters ?? []).map((p) => ({
      text: print(p, source),
      optional: p.questionToken != null || p.initializer != null || p.dotDotDotToken != null,
    })),
    returnType: node.type ? print(node.type, source) : '',
  };
}

function print(node, source) {
  return printer.printNode(ts.EmitHint.Unspecified, node, source);
}

/** Sort by code point so Node, Bun and Deno agree regardless of locale. */
function compareNames(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// --- report ----------------------------------------------------------------

const REPORT_INTRO = [
  '# @e4a/pg-js public API surface',
  '',
  'Generated from the rolled-up `dist/index.d.mts` by `pnpm api:update`. Do not edit',
  'by hand.',
  '',
  'This file is the package compatibility contract. Every change to it is a change',
  'consumers can see, so read the diff before approving: a removal or a changed',
  'signature needs a major changeset, a new export needs at least a minor one.',
  '`pnpm api:check` fails when the file drifts from the build; `pnpm api:gate`',
  'compares it against the base branch and checks the pending changeset.',
  '',
  'Private class members are omitted and members are sorted by name, so neither',
  'reordering nor internal state shows up here.',
  '',
  '',
];

const FENCE = '```';

export function renderReport(dts) {
  const model = buildModel(dts);
  const blocks = [];

  if (model.exports.length > 0) {
    const names = model.exports.map((e) => {
      const prefix = e.isTypeOnly ? 'type ' : '';
      return e.from === e.name ? `${prefix}${e.name}` : `${prefix}${e.from} as ${e.name}`;
    });
    blocks.push(`export {\n${names.map((n) => `  ${n},`).join('\n')}\n};`);
  }

  for (const name of [...model.declarations.keys()].sort(compareNames)) {
    // Overloads and merged declarations stay adjacent, in source order.
    blocks.push(model.declarations.get(name).texts.join('\n'));
  }

  return `${REPORT_INTRO.join('\n')}${FENCE}ts\n${blocks.join('\n\n')}\n${FENCE}\n`;
}

export function parseReport(markdown) {
  const start = markdown.indexOf(`${FENCE}ts\n`);
  if (start === -1) throw new Error('API report has no ```ts block');
  const bodyStart = start + FENCE.length + 3;
  const end = markdown.indexOf(`\n${FENCE}`, bodyStart);
  if (end === -1) throw new Error('API report has an unterminated ```ts block');
  return buildModel(markdown.slice(bodyStart, end));
}

// --- classification --------------------------------------------------------

/**
 * The smallest semver bump that carries `head` safely for consumers of `base`.
 *
 * Conservative on purpose: anything that is not provably additive is reported
 * as major. The one exception is a signature that only gains trailing optional
 * parameters, which is the common additive change and would otherwise force a
 * pointless major.
 */
export function classify(base, head) {
  const changes = [];

  for (const [name, baseEntry] of base.declarations) {
    const headEntry = head.declarations.get(name);
    if (!headEntry) {
      changes.push({ level: 'major', name, detail: `${baseEntry.kind} \`${name}\` was removed` });
      continue;
    }
    if (headEntry.kind !== baseEntry.kind) {
      changes.push({
        level: 'major',
        name,
        detail: `\`${name}\` changed from ${baseEntry.kind} to ${headEntry.kind}`,
      });
      continue;
    }
    if (sameTexts(baseEntry.texts, headEntry.texts)) continue;
    changes.push(...compareEntry(baseEntry, headEntry));
  }

  for (const [name, headEntry] of head.declarations) {
    if (base.declarations.has(name)) continue;
    changes.push({ level: 'minor', name, detail: `${headEntry.kind} \`${name}\` was added` });
  }

  changes.push(...compareExports(base.exports, head.exports));

  const level = changes.some((c) => c.level === 'major')
    ? 'major'
    : changes.some((c) => c.level === 'minor')
      ? 'minor'
      : 'none';

  return { level, changes };
}

/**
 * Compare the export clauses in both directions.
 *
 * The clause carries more than a set of names: an alias can be re-pointed at a
 * different declaration, and a value export can be downgraded to `export type`,
 * which breaks `new C()` at runtime while every declaration stays put. Both are
 * invisible to a name-only comparison.
 */
function compareExports(baseExports, headExports) {
  const changes = [];
  const byName = (list) => new Map(list.map((e) => [e.name, e]));
  const base = byName(baseExports);
  const head = byName(headExports);

  for (const [name, baseExport] of base) {
    const headExport = head.get(name);
    if (!headExport) {
      changes.push({ level: 'major', name, detail: `\`${name}\` is no longer exported` });
      continue;
    }
    if (headExport.from !== baseExport.from) {
      changes.push({
        level: 'major',
        name,
        detail: `export \`${name}\` now points at \`${headExport.from}\` instead of \`${baseExport.from}\``,
      });
    }
    if (headExport.isTypeOnly && !baseExport.isTypeOnly) {
      changes.push({ level: 'major', name, detail: `\`${name}\` is now exported as a type only` });
    } else if (!headExport.isTypeOnly && baseExport.isTypeOnly) {
      changes.push({ level: 'minor', name, detail: `\`${name}\` is now exported as a value too` });
    }
  }

  for (const name of head.keys()) {
    if (!base.has(name)) {
      changes.push({ level: 'minor', name, detail: `\`${name}\` is now exported` });
    }
  }

  return changes;
}

function compareEntry(baseEntry, headEntry) {
  const changes = [];

  if (baseEntry.kind === 'class' || baseEntry.kind === 'interface') {
    // Deduplicated, so merging two blocks of an interface into one is not a
    // change by itself — only the heritage clauses and type parameters are.
    const baseHeaders = [...new Set(baseEntry.headers)];
    const headHeaders = [...new Set(headEntry.headers)];
    if (!sameTexts(baseHeaders, headHeaders)) {
      const shown = headHeaders.map((header) => header.replace(/\s*\{$/, '')).join(', ');
      changes.push({
        level: 'major',
        name: baseEntry.name,
        detail: `\`${baseEntry.name}\` changed its declaration to \`${shown}\``,
      });
    }
    for (const [key, baseMember] of baseEntry.members) {
      const headMember = headEntry.members.get(key);
      if (!headMember) {
        changes.push({
          level: 'major',
          name: baseEntry.name,
          detail: `\`${baseEntry.name}.${key}\` was removed`,
        });
        continue;
      }
      if (sameTexts(baseMember.texts, headMember.texts)) continue;
      const additive = isAdditiveOverloadSet(baseMember, headMember);
      changes.push({
        level: additive ? 'minor' : 'major',
        name: baseEntry.name,
        detail: additive
          ? `\`${baseEntry.name}.${key}\` gained an optional parameter`
          : `\`${baseEntry.name}.${key}\` changed signature`,
      });
    }
    for (const [key, headMember] of headEntry.members) {
      if (baseEntry.members.has(key)) continue;
      const breaking = baseEntry.kind === 'interface' && !headMember.optional;
      changes.push({
        level: breaking ? 'major' : 'minor',
        name: baseEntry.name,
        detail: breaking
          ? `\`${baseEntry.name}.${key}\` was added as a required member`
          : `\`${baseEntry.name}.${key}\` was added`,
      });
    }
    return changes;
  }

  if (baseEntry.kind === 'function') {
    const additive = isAdditiveOverloadSet(
      { signatures: baseEntry.signatures },
      { signatures: headEntry.signatures }
    );
    return [
      {
        level: additive ? 'minor' : 'major',
        name: baseEntry.name,
        detail: additive
          ? `\`${baseEntry.name}\` gained an optional parameter`
          : `\`${baseEntry.name}\` changed signature`,
      },
    ];
  }

  return [{ level: 'major', name: baseEntry.name, detail: `${baseEntry.kind} \`${baseEntry.name}\` changed` }];
}

function sameTexts(a, b) {
  return a.length === b.length && a.every((text, i) => text === b[i]);
}

function isAdditiveOverloadSet(baseMember, headMember) {
  const baseSignatures = baseMember.signatures ?? [];
  const headSignatures = headMember.signatures ?? [];
  if (baseSignatures.length === 0 || baseSignatures.length !== headSignatures.length) return false;
  return baseSignatures.every((sig, i) => isAdditiveSignature(sig, headSignatures[i]));
}

/** True when `head` is `base` plus trailing optional parameters and nothing else. */
function isAdditiveSignature(base, head) {
  if (base.typeParameters !== head.typeParameters) return false;
  if (base.returnType !== head.returnType) return false;
  if (head.parameters.length < base.parameters.length) return false;
  for (let i = 0; i < base.parameters.length; i++) {
    if (base.parameters[i].text !== head.parameters[i].text) return false;
  }
  return head.parameters.slice(base.parameters.length).every((p) => p.optional);
}

// --- base ref --------------------------------------------------------------

/**
 * The commit a branch should be compared against: where it left `baseRef`.
 *
 * Deliberately not the tip of `baseRef`. Comparing against the tip attributes
 * every API change that landed on the base branch after the fork point to this
 * branch, so a PR that touches no public API starts demanding a major release
 * as soon as someone else's does.
 *
 * `git` runs git with the given arguments and returns stdout; it throws when
 * there is no common ancestor, which in practice means the clone is too shallow.
 */
export function comparisonBase(git, baseRef) {
  return git('merge-base', baseRef, 'HEAD').trim();
}

// --- changesets ------------------------------------------------------------

/**
 * The largest bump the pending changesets declare for `packageName`.
 *
 * `files` is a list of `{ name, content }` for the markdown files in
 * `.changeset/`. Returns 'major' | 'minor' | 'patch', or 'none' when no
 * pending changeset mentions the package.
 */
export function pendingBump(files, packageName) {
  let best = 'none';
  for (const file of files) {
    for (const bump of bumpsIn(file.content, packageName)) {
      if (BUMP_RANK[bump] > BUMP_RANK[best]) best = bump;
    }
  }
  return best;
}

function bumpsIn(content, packageName) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content.replace(/^﻿/, ''));
  if (!match) return [];
  const found = [];
  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^\s*(?:"([^"]+)"|'([^']+)'|([^:'"\s]+))\s*:\s*(major|minor|patch)\s*$/.exec(line);
    if (!entry) continue;
    const name = entry[1] ?? entry[2] ?? entry[3];
    if (name === packageName) found.push(entry[4]);
  }
  return found;
}
