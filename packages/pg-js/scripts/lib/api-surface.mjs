// Public API surface tracking for @e4a/pg-js.
//
// Pure pieces, all exercised by tests/api-surface.test.ts:
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
 *
 * The name in the rollup is not the declaration's identity: rolldown appends a
 * `$1` suffix to whichever of two same-named declarations it renames, and which
 * one that is depends on module order. So every group also carries an `id` that
 * rolldown does not choose (see `assignIds`), and a `ref…` copy of each printed
 * text in which references to other declarations are replaced by markers, so
 * `classify` can compare texts across a rename.
 */
export function buildModel(dts) {
  const source = ts.createSourceFile(VIRTUAL_FILE, dts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const exports = [];
  const declarations = new Map();
  const statements = new Map();

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
    statements.set(entry.name, [...(statements.get(entry.name) ?? []), statement]);
  }

  exports.sort((a, b) => compareNames(a.name, b.name));

  // Both passes need the full set of declaration names, so they run once the
  // loop above is done. Nothing keeps a reference to the AST: the model has to
  // compare equal whether it came from the build or from the report.
  const references = new Map();
  for (const name of declarations.keys()) {
    references.set(name, collectReferences(statements.get(name), declarations, name));
  }
  const ids = assignIds(declarations, exports, references);
  const mark = referenceMarker([...declarations.keys()]);
  for (const [name, group] of declarations) {
    group.id = ids.get(name);
    group.refTexts = group.texts.map(mark);
    group.refHeaders = group.headers.map(mark);
    group.signatures = group.signatures.map((signature) => mapSignature(signature, mark));
    for (const member of group.members.values()) {
      member.texts = member.texts.map(mark);
      member.signatures = member.signatures.map((signature) => mapSignature(signature, mark));
    }
  }

  return { exports, declarations };
}

function startGroup(entry) {
  return {
    name: entry.name,
    id: entry.name,
    kind: entry.kind,
    kinds: [entry.kind],
    texts: [entry.text],
    refTexts: [],
    headers: [entry.header],
    refHeaders: [],
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

// --- identity --------------------------------------------------------------

const HERITAGE_LABEL = '<heritage>';
const TYPE_PARAM_LABEL = '<typeparam>';
const BODY_LABEL = '<body>';

/**
 * An identity for each declaration that does not depend on the name rolldown
 * printed.
 *
 * Rolldown resolves a name collision by suffixing one of the two declarations
 * with `$1`, and which one it picks follows module order. Keying the comparison
 * on the printed name therefore turns "a new file happens to reuse an internal
 * type name" into a removal plus an unrelated addition, which reads as a major
 * break in a purely additive change. The names in `src/index.ts` are ours; the
 * suffixes are not.
 *
 * So: a declaration named in the export clause is identified by the public name
 * it is exported under (the smallest one, if several). Every other declaration
 * is identified by the route that reaches it, `<parent id>/<member>:<n>`,
 * walked breadth-first from the exported declarations, since a declaration is
 * only in the rollup because something exported references it. Both halves are
 * chosen in `src/`, not by the bundler.
 *
 * A declaration nothing references gets `?<name>` and falls back to matching by
 * name, which is all there is to go on.
 */
function assignIds(declarations, exports, references) {
  const ids = new Map();
  const roots = new Map();
  for (const entry of exports) {
    if (!declarations.has(entry.from)) continue;
    const current = roots.get(entry.from);
    if (current === undefined || compareNames(entry.name, current) < 0) roots.set(entry.from, entry.name);
  }

  let frontier = [...roots.keys()].sort((a, b) => compareNames(roots.get(a), roots.get(b)));
  for (const name of frontier) ids.set(name, roots.get(name));

  while (frontier.length > 0) {
    // Shallowest route wins, and the smallest one among equally shallow ones,
    // so the id does not depend on the order declarations happen to appear in.
    const claims = new Map();
    for (const name of frontier) {
      const parent = ids.get(name);
      for (const reference of references.get(name)) {
        if (ids.has(reference.name)) continue;
        const claim = `${parent}/${reference.label}:${reference.index}`;
        const current = claims.get(reference.name);
        if (current === undefined || compareNames(claim, current) < 0) claims.set(reference.name, claim);
      }
    }
    frontier = [...claims.keys()].sort((a, b) => compareNames(claims.get(a), claims.get(b)));
    for (const name of frontier) ids.set(name, claims.get(name));
  }

  for (const name of declarations.keys()) if (!ids.has(name)) ids.set(name, `?${name}`);
  return ids;
}

/**
 * Which other declarations a declaration mentions, and where.
 *
 * The label is the member the reference sits in, so the route to a declaration
 * survives everything except a rename of that member, which is a change of its
 * own. Identifiers that only look like a declaration name (a property named
 * after a type, say) are counted too; that costs nothing, because both sides of
 * a comparison count them the same way.
 */
function collectReferences(statements, declarations, ownName) {
  const references = [];
  const counters = new Map();

  const add = (label, name) => {
    if (name === ownName || !declarations.has(name)) return;
    const index = counters.get(label) ?? 0;
    counters.set(label, index + 1);
    references.push({ label, index, name });
  };
  const walk = (node, label) => {
    if (ts.isIdentifier(node)) add(label, node.text);
    else node.forEachChild((child) => walk(child, label));
  };

  for (const statement of statements) {
    if (ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      // A type-parameter constraint or default is a route like any other. Miss
      // it and a declaration reachable only that way gets the `?<name>` id, so
      // it falls back to matching on the printed name — the exact keying this
      // module exists to avoid.
      for (const parameter of statement.typeParameters ?? []) walk(parameter, TYPE_PARAM_LABEL);
      for (const clause of statement.heritageClauses ?? []) walk(clause, HERITAGE_LABEL);
      for (const member of statement.members) walk(member, memberKey(member));
      continue;
    }
    walk(statement, BODY_LABEL);
  }

  return references;
}

const MARKER = /«([^»]*)»/g;

/**
 * Wrap every reference to a declaration in `«…»`, so `classify` can swap the
 * names for the identities it matched the two sides on.
 *
 * Longest name first, and no word or `$` character either side, so the
 * `EmailAttributes` in `EmailAttributes$1` is not marked on its own.
 */
function referenceMarker(names) {
  if (names.length === 0) return (text) => text;
  const alternatives = [...names]
    .sort((a, b) => b.length - a.length || compareNames(a, b))
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const pattern = new RegExp(`([\\w$]*)(${alternatives})(?![\\w$])`, 'g');
  return (text) => text.replace(pattern, (match, prefix, name) => (prefix ? match : `«${name}»`));
}

/** Apply a text transform (marking, then resolving) to every type in a signature. */
function mapSignature(signature, transform) {
  return {
    typeParameters: transform(signature.typeParameters),
    parameters: signature.parameters.map((parameter) => ({ ...parameter, text: transform(parameter.text) })),
    returnType: transform(signature.returnType),
  };
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
  const { matched, keys } = matchDeclarations(base, head);
  const resolveBase = resolver(keys.base);
  const resolveHead = resolver(keys.head);
  const changes = [];

  for (const [name, baseGroup] of base.declarations) {
    const headGroup = matched.get(name);
    if (!headGroup) {
      changes.push({ level: 'major', name, detail: `${baseGroup.kind} \`${name}\` was removed` });
      continue;
    }
    // A rename only reaches consumers through the export clause, which is
    // compared separately. It does explain a report diff, so say it anyway.
    // The wording stays with what was observed: the pair matched but the
    // printed names differ. That happens when rolldown suffixes a collision,
    // and equally when the name changed in `src/`, and the two are not
    // distinguishable from the two reports alone.
    if (headGroup.name !== name) {
      changes.push({
        level: 'none',
        name: headGroup.name,
        detail: `\`${name}\` is now printed as \`${headGroup.name}\``,
      });
    }
    if (headGroup.kind !== baseGroup.kind) {
      changes.push({
        level: 'major',
        name,
        detail: `\`${name}\` changed from ${baseGroup.kind} to ${headGroup.kind}`,
      });
      continue;
    }
    const baseEntry = resolveEntry(baseGroup, resolveBase);
    const headEntry = resolveEntry(headGroup, resolveHead);
    if (sameTexts(baseEntry.refTexts, headEntry.refTexts)) continue;
    changes.push(...compareEntry(baseEntry, headEntry));
  }

  const claimed = new Set([...matched.values()].map((group) => group.name));
  for (const [name, headGroup] of head.declarations) {
    if (claimed.has(name)) continue;
    changes.push({ level: 'minor', name, detail: `${headGroup.kind} \`${name}\` was added` });
  }

  changes.push(...compareExports(base.exports, head.exports, keys));

  const level = changes.some((c) => c.level === 'major')
    ? 'major'
    : changes.some((c) => c.level === 'minor')
      ? 'minor'
      : 'none';

  return { level, changes };
}

/**
 * Decide which head declaration each base declaration became.
 *
 * Identity first (see `assignIds`), then the printed name for whatever is left
 * over. The second pass matters when a declaration's identity moved for a
 * reason of its own (it became exported, say, so its id is now the public name
 * rather than a route) while its name stayed put. Anything still unmatched is a
 * genuine removal or addition.
 *
 * `keys` gives both sides a shared name for each matched pair, which is what
 * turns the `«…»` markers back into something comparable across a rename.
 */
function matchDeclarations(base, head) {
  const matched = new Map();
  const claimed = new Set();
  const byId = new Map([...head.declarations.values()].map((group) => [group.id, group]));

  for (const [name, baseGroup] of base.declarations) {
    const headGroup = byId.get(baseGroup.id);
    if (headGroup && !claimed.has(headGroup.name)) {
      matched.set(name, headGroup);
      claimed.add(headGroup.name);
    }
  }
  for (const [name, baseGroup] of base.declarations) {
    if (matched.has(name)) continue;
    const headGroup = head.declarations.get(baseGroup.name);
    if (headGroup && !claimed.has(headGroup.name)) {
      matched.set(name, headGroup);
      claimed.add(headGroup.name);
    }
  }

  const keys = { base: new Map(), head: new Map() };
  let pair = 0;
  for (const [name, headGroup] of matched) {
    const key = `«pair ${pair++}»`;
    keys.base.set(name, key);
    keys.head.set(headGroup.name, key);
  }
  for (const name of base.declarations.keys()) {
    if (!keys.base.has(name)) keys.base.set(name, `«gone ${name}»`);
  }
  for (const name of head.declarations.keys()) {
    if (!keys.head.has(name)) keys.head.set(name, `«new ${name}»`);
  }

  return { matched, keys };
}

function resolver(keys) {
  return (text) => text.replace(MARKER, (match, name) => keys.get(name) ?? match);
}

function resolveEntry(group, resolve) {
  return {
    name: group.name,
    kind: group.kind,
    headers: group.headers,
    refHeaders: group.refHeaders.map(resolve),
    refTexts: group.refTexts.map(resolve),
    signatures: group.signatures.map((signature) => mapSignature(signature, resolve)),
    members: new Map(
      [...group.members].map(([key, member]) => [
        key,
        {
          key: member.key,
          optional: member.optional,
          texts: member.texts.map(resolve),
          signatures: member.signatures.map((signature) => mapSignature(signature, resolve)),
        },
      ])
    ),
  };
}

/**
 * Compare the export clauses in both directions.
 *
 * The clause carries more than a set of names: an alias can be re-pointed at a
 * different declaration, and a value export can be downgraded to `export type`,
 * which breaks `new C()` at runtime while every declaration stays put. Both are
 * invisible to a name-only comparison.
 *
 * What an alias points at is compared through the matched pair, not by local
 * name, so a rollup rename of an exported declaration (`export { PostGuard$1 as
 * PostGuard }`) is not read as a re-pointed alias.
 */
function compareExports(baseExports, headExports, keys) {
  const changes = [];
  const byName = (list) => new Map(list.map((e) => [e.name, e]));
  const base = byName(baseExports);
  const head = byName(headExports);
  const samePoint = (baseExport, headExport) => {
    const baseKey = keys.base.get(baseExport.from);
    const headKey = keys.head.get(headExport.from);
    // Neither side tracks the declaration (a multi-declarator `const`, say):
    // the local name is all there is to compare.
    if (baseKey === undefined || headKey === undefined) return baseExport.from === headExport.from;
    return baseKey === headKey;
  };

  for (const [name, baseExport] of base) {
    const headExport = head.get(name);
    if (!headExport) {
      changes.push({ level: 'major', name, detail: `\`${name}\` is no longer exported` });
      continue;
    }
    if (!samePoint(baseExport, headExport)) {
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
    const baseHeaders = [...new Set(baseEntry.refHeaders)];
    const headHeaders = [...new Set(headEntry.refHeaders)];
    if (!sameTexts(baseHeaders, headHeaders)) {
      const shown = [...new Set(headEntry.headers)].map((header) => header.replace(/\s*\{$/, '')).join(', ');
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
