// Tests for the sign-attribute prefill flow (src/lib/settings.ts).
//
// #199 reported sender attributes being dropped from the signing request
// entirely. The fix builds one entry per SIGN_PREFILL_TYPES — a mandatory
// { t, v } when the user prefilled a value in Settings, { t, optional: true }
// when they left it blank — and both send paths (taskpane/compose-view.ts,
// launchevent/launchevent.ts) hand the result to
// `pg.sign.yivi({ ... } as never)`. That cast means a shape change reaches
// Yivi unchallenged, so nothing but these assertions stands between a
// refactor and the reported bug coming back silently.
//
// Every case drives state through setSignPrefills, which is both the path the
// Settings view uses and the only thing that refreshes settings.ts's
// module-level prefill cache: writing into the store behind the Office stub
// instead would leave buildSignAttributes reading a stale cache.

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

// settings.ts reads through storage.ts, which touches the bare global
// `Office`. Neither module dereferences it at import time, so installing the
// stub here — after the imports have been evaluated — is early enough.
//
// storage.ts resolves its save promise by comparing the callback's status
// against `Office.AsyncResultStatus.Succeeded`, so the stub has to supply
// both sides of that comparison itself. The value is the string Office.js
// hands over at runtime; @types/office-js declares the enum as numeric.
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

// assert.deepEqual is deepStrictEqual under node:assert/strict, and that
// rejects an unexpected own property as well as a changed one — so an entry
// carrying both `v` and `optional` fails these comparisons.
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
    // A duplicate would ask Yivi twice for one attribute; a missing type is
    // the #199 bug. Comparing the whole list pins both, and the order.
    assert.deepEqual(
      buildSignAttributes().map((a) => a.t),
      [...SIGN_PREFILL_TYPES]
    );
  }
});

// setSignPrefills trims and drops, so whitespace never reaches storage and the
// attribute comes back optional. buildSignAttributes trims again, but that
// second layer only guards a value that arrived in roamingSettings without
// passing through setSignPrefills — a legacy blob — and reaching it means
// seeding the store directly, which the stale cache above rules out. So this
// pins the first layer only.
test("a whitespace-only prefill is not a value", async () => {
  await setSignPrefills({ [SIGN_PREFILL_FULLNAME]: "   " });

  assert.deepEqual(
    buildSignAttributes().find((a) => a.t === SIGN_PREFILL_FULLNAME),
    { t: SIGN_PREFILL_FULLNAME, optional: true }
  );
});

test("no email attribute is offered, since pg-js prepends its own", async () => {
  await setSignPrefills({ [SIGN_PREFILL_FULLNAME]: FULLNAME });

  // buildStartRequestBody in pg-js puts the sender's email attribute at the
  // head of every signing request, so one here would be disclosed twice. The
  // pattern covers the production `pbdf.*` type and the test-scheme
  // `irma-demo.*` one without reaching into pg-js for the constant.
  for (const t of [...SIGN_PREFILL_TYPES, ...buildSignAttributes().map((a) => a.t)]) {
    assert.doesNotMatch(t, /\.email\.email$/);
  }
});
