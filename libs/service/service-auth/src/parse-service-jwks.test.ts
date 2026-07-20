import { expect, test } from 'bun:test';
import * as jose from 'jose';
import { createServiceToken } from './create-service-token';
import { parseServiceJWKS } from './parse-service-jwks';
import { TOKEN_ALGORITHM } from './token-claims';

test('it parses a JWKS whose key resolves tokens signed by the matching private key', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });
  const jwk = await jose.exportJWK(keyPair.publicKey);

  const keySet = parseServiceJWKS(JSON.stringify({ keys: [{ ...jwk, kid: 'app-web' }] }));

  const token = await createServiceToken({
    audience: 'avatar',
    issuer: 'app-web',
    privateKey: keyPair.privateKey,
  });

  await expect(jose.jwtVerify(token, keySet, { audience: 'service-avatar' })).toResolve();
});

test('it rejects malformed JSON', () => {
  expect(() => parseServiceJWKS('not-json')).toThrow(SyntaxError);
});

test('it rejects a JWKS entry missing its kid', () => {
  expect(() =>
    parseServiceJWKS('{"keys":[{"kty":"OKP","crv":"Ed25519","x":"abc"}]}'),
  ).toThrowWithMessage(Error, /"keys",\s*0,\s*"kid"/);
});

test('it rejects a JWKS entry that is not an Ed25519 public key', () => {
  expect(() =>
    parseServiceJWKS('{"keys":[{"kty":"RSA","n":"abc","e":"AQAB","kid":"app-web"}]}'),
  ).toThrowWithMessage(Error, /"keys",\s*0,\s*"crv"/);
});

test('it rejects a payload with no keys array', () => {
  expect(() => parseServiceJWKS('{}')).toThrowWithMessage(Error, /keys/);
});
