import { expect, test } from 'bun:test';
import * as jose from 'jose';
import { buildServiceAudience } from './build-service-audience';
import { createServiceToken } from './create-service-token';
import { parseServiceToken } from './parse-service-token';
import { TOKEN_ALGORITHM } from './token-claims';

test('it resolves the acting user from a token minted for the matching audience', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM);

  const token = await createServiceToken({
    actingUserId: 'user-1',
    audience: 'avatar',
    privateKey: keyPair.privateKey,
  });

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await parseServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    publicKey: keyPair.publicKey,
  });

  expect(resolution).toStrictEqual({ actingUserId: 'user-1' });
});

test('it resolves a null acting user from a token minted with no actingUserId', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM);

  const token = await createServiceToken({
    audience: 'session',
    privateKey: keyPair.privateKey,
  });

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await parseServiceToken(request, {
    audience: buildServiceAudience('session'),
    publicKey: keyPair.publicKey,
  });

  expect(resolution).toStrictEqual({ actingUserId: null });
});

test('it rejects a token minted for a different audience', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM);

  const token = await createServiceToken({
    audience: 'session',
    privateKey: keyPair.privateKey,
  });

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await parseServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    publicKey: keyPair.publicKey,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects a token minted by a different issuer', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM);

  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: TOKEN_ALGORITHM })
    .setIssuer('some-other-issuer')
    .setAudience(buildServiceAudience('avatar'))
    .setExpirationTime('60s')
    .sign(keyPair.privateKey);

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await parseServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    publicKey: keyPair.publicKey,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects an expired token', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM);

  const token = await createServiceToken({
    audience: 'avatar',
    expiresIn: '-1s',
    privateKey: keyPair.privateKey,
  });

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await parseServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    publicKey: keyPair.publicKey,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects a request with no Authorization header', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM);

  const request = new Request('http://test.local');

  const resolution = await parseServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    publicKey: keyPair.publicKey,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects a non-Bearer Authorization header', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM);

  const request = new Request('http://test.local', {
    headers: { authorization: 'Basic dXNlcjpwYXNz' },
  });

  const resolution = await parseServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    publicKey: keyPair.publicKey,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects a garbage token string', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM);

  const request = new Request('http://test.local', {
    headers: { authorization: 'Bearer not-a-real-token' },
  });

  const resolution = await parseServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    publicKey: keyPair.publicKey,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});
