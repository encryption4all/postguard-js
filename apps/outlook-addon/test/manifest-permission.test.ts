// Pins the manifest's requested permission tier to the highest tier the code
// in src/ actually needs (encryption4all/postguard-js#254).
//
// `ReadWriteMailbox` is the top tier and forces admin-only installation, so an
// end user cannot self-install the add-in. The tier the code needs is
// `ReadWriteItem`, from six compose writes: `Body.setAsync`,
// `removeAttachmentAsync`, `addFileAttachmentFromBase64Async`, `saveAsync`,
// and `InternetHeaders.setAsync` / `removeAsync`.
//
// Two assertions, because the constant alone would only restate itself: the
// manifest declares the narrower tier, and no Office.js member that *needs*
// the wider one is reachable from src/. The second is what keeps the first
// true — reach for `makeEwsRequestAsync` and this fails, instead of the
// add-in failing at runtime in a user's mailbox.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const appRoot = new URL("../", import.meta.url);
const manifest = readFileSync(fileURLToPath(new URL("manifest.xml", appRoot)), "utf8");

test("the manifest requests read/write item, not read/write mailbox", () => {
  const declared = [...manifest.matchAll(/<Permissions>([^<]+)<\/Permissions>/g)].map((m) => m[1]);
  assert.deepEqual(declared, ["ReadWriteItem"]);
});

// Microsoft annotates every Office.js member in @types/office-js with its
// "Minimum permission level", and that annotation is the method the add-in
// permissions doc itself prescribes for sizing the tier. We read it rather
// than keeping a hand-written list, so a types bump that moves a member
// between tiers is picked up here instead of going unnoticed.
//
// Only member names annotated read/write mailbox and *never* at a lower tier
// are usable as a signal: `subject`, `getAsync` and `removeAsync` all appear
// at read/write mailbox (on `SelectedItemDetails` and `MasterCategories`) and
// also on the ordinary item, so matching them by name would flag every
// well-behaved call. The difference leaves the members whose name alone is
// proof: `makeEwsRequestAsync`, `masterCategories`, `sendAsync`,
// `getSelectedItemsAsync`, `loadItemByIdAsync`.
const TIER_PATTERN =
  /Minimum permission level[^*]*\*\*:\s*\*\*(restricted|read item|read\/write item|read\/write mailbox)\*\*/i;

function membersByTier(dts: string): Map<string, Set<string>> {
  const lines = dts.split("\n");
  const tiers = new Map<string, Set<string>>();
  let annotations = 0;
  for (let i = 0; i < lines.length; i++) {
    const tier = lines[i].match(TIER_PATTERN)?.[1].toLowerCase();
    if (!tier) continue;
    annotations++;
    // The annotation sits inside a JSDoc block; the member it documents is the
    // first declaration after that block closes.
    const end = lines.findIndex((l, j) => j >= i && /\*\//.test(l));
    if (end < 0) continue;
    for (let k = end + 1; k < Math.min(end + 6, lines.length); k++) {
      const name = lines[k].match(/^\s*(?:readonly\s+)?([A-Za-z0-9_]+)\s*[(:?]/)?.[1];
      if (!name) continue;
      if (!tiers.has(name)) tiers.set(name, new Set());
      tiers.get(name)!.add(tier);
      break;
    }
  }
  // Fail loudly on a shape we cannot read, rather than asserting nothing: the
  // installed types carry ~600 of these annotations.
  assert.ok(annotations > 100, `only ${annotations} permission annotations parsed`);
  return tiers;
}

// Comments hold prose about the wider tier (this file included), so they are
// stripped before the scan — the question is what the code reaches, not what
// the code talks about. `//` preceded by `:` is left alone so a `https://` URL
// inside a string does not swallow the rest of its line.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("no Office.js member that needs read/write mailbox is reachable from src/", () => {
  const require = createRequire(import.meta.url);
  const dts = readFileSync(require.resolve("@types/office-js/index.d.ts"), "utf8");
  const tiers = membersByTier(dts);

  const mailboxOnly = [...tiers]
    .filter(([, t]) => t.size === 1 && t.has("read/write mailbox"))
    .map(([name]) => name)
    .sort();
  assert.ok(
    mailboxOnly.length >= 5,
    `expected the mailbox-only member set to be non-trivial, got ${mailboxOnly.join(", ")}`
  );

  const srcDir = fileURLToPath(new URL("src", appRoot));
  const sources = readdirSync(srcDir, { recursive: true, encoding: "utf8" }).filter((f) =>
    f.endsWith(".ts")
  );
  assert.ok(sources.length > 10, `expected to scan the whole of src/, found ${sources.length}`);

  const hits: string[] = [];
  for (const file of sources) {
    const code = stripComments(readFileSync(`${srcDir}/${file}`, "utf8"));
    for (const name of mailboxOnly) {
      if (new RegExp(`\\b${name}\\b`).test(code)) hits.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(
    hits,
    [],
    `these need ReadWriteMailbox, which the manifest no longer requests:\n${hits.join("\n")}`
  );
});
