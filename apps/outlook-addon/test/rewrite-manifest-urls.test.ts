// Tests for the manifest URL rewrite guard (scripts/rewrite-manifest-urls.mjs).
//
// Run with Node's built-in test runner (no extra dependencies):
//   pnpm test
//
// These pin the two failures from #257. A production build whose rewrite
// changed nothing shipped a manifest still pointing at https://localhost:3000/,
// and every gate downstream passed it: webpack exited 0, office-addin-manifest
// validated it, and scopeAppDomains() dropped the unrewritten entry as unused.
// The mutation that proves it end to end is a full production build with
// `urlDev` set to a port manifest.xml does not use; these cover the same two
// cases without one.

import { test } from "node:test";
import assert from "node:assert/strict";
import { rewriteManifestUrls } from "../scripts/rewrite-manifest-urls.mjs";

const URL_DEV = "https://localhost:3000/";
const URL_PROD = "https://addin.postguard.eu/";

// Shaped like the parts of manifest.xml that carry the dev origin.
const manifest = [
  '<IconUrl DefaultValue="https://localhost:3000/assets/icon-64.png"/>',
  "<AppDomain>https://localhost:3000/</AppDomain>",
  '<SourceLocation DefaultValue="https://localhost:3000/taskpane.html"/>',
  '<bt:Url id="Taskpane.Url" DefaultValue="https://localhost:3000/taskpane.html"/>',
].join("\n");

test("rewrites every occurrence of the dev origin to the production one", () => {
  const out = rewriteManifestUrls(manifest, URL_DEV, URL_PROD);

  assert.equal(
    out,
    [
      '<IconUrl DefaultValue="https://addin.postguard.eu/assets/icon-64.png"/>',
      "<AppDomain>https://addin.postguard.eu/</AppDomain>",
      '<SourceLocation DefaultValue="https://addin.postguard.eu/taskpane.html"/>',
      '<bt:Url id="Taskpane.Url" DefaultValue="https://addin.postguard.eu/taskpane.html"/>',
    ].join("\n")
  );
});

test("throws when the rewrite matches nothing", () => {
  // What a changed dev-server port or a hand-edited URL looks like: urlDev no
  // longer spells what manifest.xml holds, so the replace is a no-op.
  assert.throws(
    () => rewriteManifestUrls(manifest, "https://localhost:3999/", URL_PROD),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      // The message has to name both URLs, or the reader cannot tell which of
      // the two spellings is the one to correct.
      assert.match(err.message, /https:\/\/localhost:3999\//);
      assert.match(err.message, /https:\/\/addin\.postguard\.eu\//);
      return true;
    }
  );
});

test("throws when a differently spelled dev URL survives the rewrite", () => {
  // urlDev carries a trailing slash, so a bare-origin entry is not matched even
  // though the rest of the manifest rewrites fine.
  const partial = `${manifest}\n<AppDomain>https://localhost:3000</AppDomain>`;

  assert.throws(
    () => rewriteManifestUrls(partial, URL_DEV, URL_PROD),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /https:\/\/localhost:3000/);
      return true;
    }
  );
});

test("reports the no-match, not a leftover, when urlDev matches nothing at all", () => {
  // Pins which of the two errors a caller gets: the count check runs first, so a
  // manifest whose only dev URL is spelled differently than urlDev is reported
  // as a no-match. Both spellings are wrong, but the messages point at different
  // fixes and the more specific one would be misleading here.
  assert.throws(
    () => rewriteManifestUrls("<AppDomain>https://localhost:3000</AppDomain>", URL_DEV, URL_PROD),
    /contains no occurrence of/
  );
});
