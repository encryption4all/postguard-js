// postguard#236: the email attribute types are configurable so test
// environments (which cannot issue pbdf credentials) can run the identical
// code paths under a test scheme. Defaults must remain the production pbdf
// types — existing callers are unaffected.
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EMAIL_ATTRIBUTES,
  resolveEmailAttributes,
} from '../src/util/attributes.js';
import { buildEncryptionPolicy } from '../src/recipients/builders.js';
import { buildKeyRequest } from '../src/util/policy.js';
import { buildStartRequestBody } from '../src/signing/yivi.js';
import { RecipientBuilder } from '../src/recipients/builder.js';

const TEST_ATTRS = {
  email: 'irma-demo.sidn-pbdf.email.email',
  domain: 'irma-demo.sidn-pbdf.email.domain',
};

describe('email attribute configuration (postguard#236)', () => {
  it('defaults to the production pbdf types', () => {
    expect(resolveEmailAttributes()).toEqual(DEFAULT_EMAIL_ATTRIBUTES);
    expect(DEFAULT_EMAIL_ATTRIBUTES.email).toBe('pbdf.sidn-pbdf.email.email');
    expect(DEFAULT_EMAIL_ATTRIBUTES.domain).toBe('pbdf.sidn-pbdf.email.domain');
  });

  it('merges partial overrides with defaults', () => {
    const attrs = resolveEmailAttributes({ email: TEST_ATTRS.email });
    expect(attrs.email).toBe(TEST_ATTRS.email);
    expect(attrs.domain).toBe(DEFAULT_EMAIL_ATTRIBUTES.domain);
  });

  it('recipient policies use the configured types', () => {
    const alice = new RecipientBuilder('alice@example.com', 'email');
    const anyCorp = new RecipientBuilder('bob@corp.example', 'emailDomain');

    const policy = buildEncryptionPolicy([alice, anyCorp], 1234, TEST_ATTRS);

    expect(policy['alice@example.com'].con).toEqual([
      { t: TEST_ATTRS.email, v: 'alice@example.com' },
    ]);
    expect(policy['bob@corp.example'].con).toEqual([
      { t: TEST_ATTRS.domain, v: 'corp.example' },
    ]);
  });

  it('key requests pin the recipient value on the configured email type', () => {
    const policy = {
      ts: 1234,
      con: [
        { t: TEST_ATTRS.email },
        { t: 'irma-demo.gemeente.personalData.fullname', v: 'should-be-stripped' },
      ],
    };

    const req = buildKeyRequest('alice@example.com', policy, TEST_ATTRS);

    const email = req.con.find((c) => c.t === TEST_ATTRS.email);
    expect(email?.v).toBe('alice@example.com');
    const other = req.con.find((c) => c.t !== TEST_ATTRS.email);
    expect(other?.v).toBeUndefined();
  });

  it('yivi signing start requests prepend the configured email type', () => {
    const body = buildStartRequestBody({
      element: '#x',
      senderEmail: 'sender@example.com',
      emailAttributes: TEST_ATTRS,
    });
    expect(body.con[0]).toEqual({ t: TEST_ATTRS.email, v: 'sender@example.com' });
  });

  it('without overrides, everything keeps the production types', () => {
    const alice = new RecipientBuilder('alice@example.com', 'email');
    const policy = buildEncryptionPolicy([alice], 1);
    expect(policy['alice@example.com'].con[0].t).toBe('pbdf.sidn-pbdf.email.email');

    const body = buildStartRequestBody({ element: '#x' });
    expect(body.con[0].t).toBe('pbdf.sidn-pbdf.email.email');
  });
});
