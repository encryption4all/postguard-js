import { describe, it, expect } from 'vitest';
import { decodeJwtPayloadUnsafe } from '../src/util/jwt.js';

function makeJwt(payload: unknown): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

describe('decodeJwtPayloadUnsafe', () => {
  it('decodes a well-formed base64url payload to an object', () => {
    const jwt = makeJwt({ exp: 1234, sub: 'alice' });
    expect(decodeJwtPayloadUnsafe(jwt)).toEqual({ exp: 1234, sub: 'alice' });
  });

  it('decodes multibyte UTF-8 claims correctly', () => {
    const jwt = makeJwt({ name: 'Renée Müller', email: 'josé@exämple.com' });
    expect(decodeJwtPayloadUnsafe(jwt)).toEqual({
      name: 'Renée Müller',
      email: 'josé@exämple.com',
    });
  });

  it('handles url-safe characters and missing padding', () => {
    // Force a payload that base64url-encodes with `-`/`_` and no `=` padding.
    const payload = { data: '???>>>???' };
    const jwt = makeJwt(payload);
    expect(decodeJwtPayloadUnsafe(jwt)).toEqual(payload);
  });

  it('returns null for a token without three segments', () => {
    expect(decodeJwtPayloadUnsafe('a.b')).toBeNull();
    expect(decodeJwtPayloadUnsafe('a.b.c.d')).toBeNull();
    expect(decodeJwtPayloadUnsafe('onlyone')).toBeNull();
  });

  it('returns null when a segment is empty', () => {
    expect(decodeJwtPayloadUnsafe('a..c')).toBeNull();
    expect(decodeJwtPayloadUnsafe('.b.c')).toBeNull();
    expect(decodeJwtPayloadUnsafe('a.b.')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(decodeJwtPayloadUnsafe(undefined)).toBeNull();
    expect(decodeJwtPayloadUnsafe(null)).toBeNull();
    expect(decodeJwtPayloadUnsafe(42)).toBeNull();
    expect(decodeJwtPayloadUnsafe({})).toBeNull();
  });

  it('returns null when the payload is not valid JSON', () => {
    const header = Buffer.from('{}').toString('base64url');
    const badPayload = Buffer.from('not json').toString('base64url');
    expect(decodeJwtPayloadUnsafe(`${header}.${badPayload}.sig`)).toBeNull();
  });

  it('returns null when the payload is JSON but not an object', () => {
    expect(decodeJwtPayloadUnsafe(makeJwt(42))).toBeNull();
    expect(decodeJwtPayloadUnsafe(makeJwt('a string'))).toBeNull();
    expect(decodeJwtPayloadUnsafe(makeJwt([1, 2, 3]))).toBeNull();
    expect(decodeJwtPayloadUnsafe(makeJwt(null))).toBeNull();
  });
});
