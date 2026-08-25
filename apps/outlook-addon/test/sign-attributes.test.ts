// Tests for the sign-attribute prefill flow (src/lib/settings.ts).
//
// #199 reported sender attributes being dropped from the signing request
// entirely. The fix shipped, but both send paths hand the result to
// `pg.sign.yivi({ ... } as never)`, and that cast lets a shape change through
// unchallenged — so these assertions are all that stands between a refactor and
// the reported bug returning silently.
//
// Every case drives state through setSignPrefills: it is the path the Settings
// view uses, and once it has run, the module-level prefill cache in settings.ts
// shadows the store, so seeding that store behind the Office stub would not be
// read back. Only a read before the first write goes through to storage.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SIGN_PREFILL_TYPES,
  SIGN_PREFILL_FULLNAME,
  SIGN_PREFILL_DATEOFBIRTH,
  SIGN_PREFILL_MOBILE,
  buildSignAttributes,
  setSignPrefills,
  type SignPrefillType,
} from "../src/lib/settings.ts";

// storage.ts touches the bare global `Office`, but neither module dereferences
// it at import time, so installing the stub after the imports is early enough.
// storage.ts resolves its save promise by comparing the callback status against
// `Office.AsyncResultStatus.Succeeded`, so the stub supplies both sides of that
// comparison itself and the literal only has to be self-consistent.
const roaming = new Map<string, unknown>();

(globalThis as { Office?: unknown }).Office = {
  AsyncResultStatus: { Succeeded: "succeeded" },
  context: {
    roamingSettings: {
      get: (key: string) => roaming.get(key),
      set: (key: string, value: unknown) => {
        roaming.set(key, value);
      },
      saveAsync: (callback: (result: { status: string }) => void) => {
        callback({ status: "succeeded" });
      },
    },
  },
};

const FULLNAME = "Alice Example";
const DATEOFBIRTH = "1990-01-31";
const MOBILE = "+31612345678";

// assert.deepEqual is deepStrictEqual under node:assert/strict, so it rejects an
// unexpected own property too: an entry carrying both `v` and `optional` fails.
test("blank prefills make every attribute optional, in declaration order", async () => {
  await setSignPrefills({});

  assert.deepEqual(
    buildSignAttributes(),
    SIGN_PREFILL_TYPES.map((t) => ({ t, optional: true }))
  );
});

test("prefilled values make every attribute a mandatory disclosure", async () => {
  await setSignPrefills({
    [SIGN_PREFILL_FULLNAME]: FULLNAME,
    [SIGN_PREFILL_DATEOFBIRTH]: DATEOFBIRTH,
    [SIGN_PREFILL_MOBILE]: MOBILE,
  });

  assert.deepEqual(buildSignAttributes(), [
    { t: SIGN_PREFILL_FULLNAME, v: FULLNAME },
    { t: SIGN_PREFILL_DATEOFBIRTH, v: DATEOFBIRTH },
    { t: SIGN_PREFILL_MOBILE, v: MOBILE },
  ]);
});

test("one prefilled value among three leaves the other two optional", async () => {
  await setSignPrefills({ [SIGN_PREFILL_DATEOFBIRTH]: DATEOFBIRTH });
  const attrs = buildSignAttributes();

  assert.deepEqual(
    attrs.filter((a) => a.v !== undefined),
    [{ t: SIGN_PREFILL_DATEOFBIRTH, v: DATEOFBIRTH }]
  );
  assert.deepEqual(
    attrs.filter((a) => a.optional === true).map((a) => a.t),
    [SIGN_PREFILL_FULLNAME, SIGN_PREFILL_MOBILE]
  );
});

test("every prefill type appears exactly once, whatever the prefill state", async () => {
  const states: Partial<Record<SignPrefillType, string>>[] = [
    {},
    { [SIGN_PREFILL_FULLNAME]: FULLNAME },
    { [SIGN_PREFILL_MOBILE]: MOBILE, [SIGN_PREFILL_FULLNAME]: FULLNAME },
    {
      [SIGN_PREFILL_FULLNAME]: FULLNAME,
      [SIGN_PREFILL_DATEOFBIRTH]: DATEOFBIRTH,
      [SIGN_PREFILL_MOBILE]: MOBILE,
    },
  ];

  for (const state of states) {
    await setSignPrefills(state);
    // A duplicate would ask Yivi twice for one attribute; a missing one is #199.
    assert.deepEqual(
      buildSignAttributes().map((a) => a.t),
      [...SIGN_PREFILL_TYPES]
    );
  }
});

// This pins the setSignPrefills layer, which trims and drops, so whitespace
// never reaches storage. buildSignAttributes trims again, guarding a value that
// reached roamingSettings without passing through setSignPrefills — a legacy
// persisted value read by the launchevent, whose runtime starts with an empty
// cache. Pinning that layer needs its own file: seed the store before the first
// read, or the cache this file's setSignPrefills calls populate shadows it.
test("a whitespace-only prefill is not a value", async () => {
  await setSignPrefills({ [SIGN_PREFILL_FULLNAME]: "   " });

  assert.deepEqual(
    buildSignAttributes().find((a) => a.t === SIGN_PREFILL_FULLNAME),
    { t: SIGN_PREFILL_FULLNAME, optional: true }
  );
});

test("no email attribute is offered, since pg-js prepends its own", async () => {
  await setSignPrefills({ [SIGN_PREFILL_FULLNAME]: FULLNAME });

  // pg-js prepends the sender's email attribute to every signing request, so one
  // here would be disclosed twice. The pattern covers the production `pbdf.*`
  // type and the test-scheme `irma-demo.*` one without reaching into pg-js.
  for (const t of [...SIGN_PREFILL_TYPES, ...buildSignAttributes().map((a) => a.t)]) {
    assert.doesNotMatch(t, /\.email\.email$/);
  }
});
