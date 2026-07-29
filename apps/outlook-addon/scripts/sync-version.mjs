// Propagate package.json's version into manifest.xml's <Version>.
//
// changesets bumps package.json only. Outlook keys sideloaded and centrally-
// deployed updates on the manifest's <Version>, so a manifest frozen at
// 1.0.0.0 means an admin who re-uploads a newer add-in has no version change
// to point at — every release ships a manifest claiming the same version.
//
// The two formats differ: package.json is semver (`0.4.1`), the manifest is a
// four-part Office version (`0.4.1.0`). The fourth part is the revision, which
// nothing here uses, so it is pinned to 0 rather than invented.
//
// Run from apps/outlook-addon: `node scripts/sync-version.mjs [--check]`
// `--check` reports and exits non-zero instead of writing, for CI.

import { readFileSync, writeFileSync } from "node:fs";

const check = process.argv.includes("--check");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const { version } = pkg;

// Office rejects a non-numeric version, so a prerelease or build-metadata
// version has no faithful four-part form. Refusing beats silently truncating
// `0.5.0-rc.1` to `0.5.0.0` and shipping a manifest that claims to be the
// release.
const semver = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!semver) {
  console.error(
    `package.json version ${version} is not a plain major.minor.patch, ` +
      "which is the only form expressible as an Office <Version>."
  );
  process.exit(1);
}
const officeVersion = `${semver[1]}.${semver[2]}.${semver[3]}.0`;

// Only the document-level <Version> — the manifest also carries MinVersion and
// DefaultMinVersion attributes for requirement sets, which are Office API
// versions and unrelated to the add-in's own version.
const VERSION_ELEMENT = /^(\s*)<Version>([^<]*)<\/Version>/m;

const manifestPath = "manifest.xml";
const manifest = readFileSync(manifestPath, "utf8");
const found = VERSION_ELEMENT.exec(manifest);
if (!found) {
  console.error(`${manifestPath} has no <Version> element to sync`);
  process.exit(1);
}
const current = found[2];

if (check) {
  if (current !== officeVersion) {
    console.error(
      `versions are out of sync:\n  ${manifestPath} says ${current}, ` +
        `package.json says ${version} (expected <Version>${officeVersion}</Version>)`
    );
    console.error(
      "\nRun `pnpm --filter postguard-outlook-addin sync-version` and commit the result."
    );
    process.exit(1);
  }
  console.log(`${manifestPath} and package.json agree: ${officeVersion} / ${version}`);
  process.exit(0);
}

if (current === officeVersion) {
  console.log(`${manifestPath} already says ${officeVersion}; nothing to do`);
  process.exit(0);
}

writeFileSync(
  manifestPath,
  manifest.replace(VERSION_ELEMENT, `$1<Version>${officeVersion}</Version>`)
);
console.log(`synced ${manifestPath} to ${officeVersion} (package.json ${version})`);
