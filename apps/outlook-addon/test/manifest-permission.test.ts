// Pins the manifest's requested permission tier to the highest tier the code
// in src/ actually needs (encryption4all/postguard-js#254).
//
// `ReadWriteMailbox` is the top tier and forces admin-only installation, so an
// end user cannot self-install the add-in. The tier the code needs is
// `ReadWriteItem`, from six compose writes: `Body.setAsync`,
// `removeAttachmentAsync`, `addFileAttachmentFromBase64Async`, `saveAsync`,
// and `InternetHeaders.setAsync` / `removeAsync`.
//
// Two checks, because the constant alone would only restate itself: the
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
// Two filters turn those annotations into names whose bare presence in src/ is
// proof of a reach for the wider tier. First, drop any name that also appears
// at a lower tier: `subject`, `getAsync` and `removeAsync` are annotated
// read/write mailbox on `SelectedItemDetails` and `MasterCategories` and also
// sit on the ordinary item, so matching them by name would flag every
// well-behaved call. Second, drop any name that only exists on an object
// another surviving name hands you — see the reachability filter below. What
// is left is
// the five gates: `makeEwsRequestAsync`, `masterCategories`, `sendAsync`,
// `getSelectedItemsAsync` and `loadItemByIdAsync`.
const TIER_PATTERN =
  /Minimum permission level[^*]*\*\*:\s*\*\*(restricted|read item|read\/write item|read\/write mailbox)\*\*/i;

type Member = {
  tiers: Set<string>;
  // The interface or class the member is declared on, and the declaration
  // lines themselves — both needed to tell a member an add-in can reach from
  // one that only exists on an object some other member returns.
  declaredOn: Set<string>;
  declarations: string[];
};

function membersByTier(dts: string): Map<string, Member> {
  const lines = dts.split("\n");
  const members = new Map<string, Member>();
  let annotations = 0;
  let declaringInterface = "";
  for (let i = 0; i < lines.length; i++) {
    const enclosing = lines[i].match(
      /^\s*(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?(?:interface|class)\s+([A-Za-z0-9_]+)/
    );
    if (enclosing) declaringInterface = enclosing[1];
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
      let member = members.get(name);
      if (!member) {
        member = { tiers: new Set(), declaredOn: new Set(), declarations: [] };
        members.set(name, member);
      }
      member.tiers.add(tier);
      member.declaredOn.add(declaringInterface);
      member.declarations.push(lines[k]);
      break;
    }
  }
  // Fail loudly on a shape we cannot read, rather than asserting nothing: the
  // installed types carry ~600 of these annotations.
  assert.ok(annotations > 100, `only ${annotations} permission annotations parsed`);
  return members;
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
  const members = membersByTier(dts);

  const tierExclusive = [...members].filter(
    ([, m]) => m.tiers.size === 1 && m.tiers.has("read/write mailbox")
  );

  // Reachability, the second filter. `hasAttachment` and `itemMode` are
  // annotated read/write mailbox and nowhere else, but they are declared on
  // `SelectedItemDetails`, which an add-in can only obtain by calling
  // `getSelectedItemsAsync` — already in the set. They add no reach, and both
  // are ordinary enough as identifiers that a local in an attachment-handling
  // add-in collides with them (`const hasAttachment = parts.length > 0`), so
  // keeping them would cost false positives and buy nothing. An interface is
  // handed out when another candidate's declaration names it; a member is
  // dropped only when every interface declaring it is handed out that way.
  // A declaration we cannot attribute counts as reachable — keeping a member
  // we cannot place is the conservative direction.
  const handedOutByAnotherCandidate = (declaringInterface: string, self: string) =>
    declaringInterface !== "" &&
    tierExclusive.some(
      ([name, m]) =>
        name !== self &&
        m.declarations.some((d) => new RegExp(`\\b${declaringInterface}\\b`).test(d))
    );
  const mailboxOnly = tierExclusive
    .filter(([name, m]) =>
      [...m.declaredOn].some(
        (declaringInterface) => !handedOutByAnotherCandidate(declaringInterface, name)
      )
    )
    .map(([name]) => name)
    .sort();

  // A count is not a floor. `hasAttachment` and `itemMode` padded this set to
  // seven, so before the reachability filter the derivation could lose BOTH
  // `makeEwsRequestAsync` and `sendAsync` — the two members that actually gate
  // EWS and send — and still clear a `>= 5` check, leaving the scan below
  // silently blind. Name the gates instead. The scan set stays derived, so a
  // types bump that moves a member between tiers is still picked up; this only
  // asserts the derivation did not quietly drop one.
  for (const gate of [
    "getSelectedItemsAsync",
    "loadItemByIdAsync",
    "makeEwsRequestAsync",
    "masterCategories",
    "sendAsync",
  ]) {
    assert.ok(
      mailboxOnly.includes(gate),
      `${gate} is no longer derivable as mailbox-tier, so the scan is blind to it. Got: ${mailboxOnly.join(", ")}`
    );
  }

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
