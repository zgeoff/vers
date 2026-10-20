import { expect, test } from 'bun:test';
import * as jose from 'jose';
import { buildServiceAudience } from './build-service-audience';
import { createServiceToken } from './create-service-token';
import { parseServiceJWKS } from './parse-service-jwks';
import { TOKEN_ALGORITHM } from './token-claims';
import { verifyServiceToken } from './verify-service-token';

test('it resolves the issuer and acting user from a token minted for the matching audience', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({ keys: [{ ...(await jose.exportJWK(keyPair.publicKey)), kid: 'app-web' }] }),
  );

  const token = await createServiceToken({
    actingUserID: 'user-1',
    audience: 'avatar',
    issuer: 'app-web',
    privateKey: keyPair.privateKey,
  });

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    keySet,
  });

  expect(resolution).toStrictEqual({
    actingSessionID: null,
    actingUserID: 'user-1',
    issuer: 'app-web',
  });
});

test('it resolves the acting session from a token minted with an actingSessionID', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({ keys: [{ ...(await jose.exportJWK(keyPair.publicKey)), kid: 'app-web' }] }),
  );

  const token = await createServiceToken({
    actingSessionID: 'session-1',
    actingUserID: 'user-1',
    audience: 'avatar',
    issuer: 'app-web',
    privateKey: keyPair.privateKey,
  });

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    keySet,
  });

  expect(resolution).toStrictEqual({
    actingSessionID: 'session-1',
    actingUserID: 'user-1',
    issuer: 'app-web',
  });
});

test('it resolves a null acting user from a token minted with no actingUserID', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({
      keys: [{ ...(await jose.exportJWK(keyPair.publicKey)), kid: 'service-activity' }],
    }),
  );

  const token = await createServiceToken({
    audience: 'replay',
    issuer: 'service-activity',
    privateKey: keyPair.privateKey,
  });

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('replay'),
    keySet,
  });

  expect(resolution).toStrictEqual({
    actingSessionID: null,
    actingUserID: null,
    issuer: 'service-activity',
  });
});

test('it rejects a token minted for a different audience', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({ keys: [{ ...(await jose.exportJWK(keyPair.publicKey)), kid: 'app-web' }] }),
  );

  const token = await createServiceToken({
    audience: 'session',
    issuer: 'app-web',
    privateKey: keyPair.privateKey,
  });

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    keySet,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects a token claiming an issuer outside the minting set', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({ keys: [{ ...(await jose.exportJWK(keyPair.publicKey)), kid: 'app-web' }] }),
  );

  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: TOKEN_ALGORITHM, kid: 'some-other-issuer' })
    .setIssuer('some-other-issuer')
    .setAudience(buildServiceAudience('avatar'))
    .setExpirationTime('60s')
    .sign(keyPair.privateKey);

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    keySet,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects a token claiming another minter with a signature by a different key', async () => {
  const webKeyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });
  const activityKeyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({
      keys: [
        { ...(await jose.exportJWK(webKeyPair.publicKey)), kid: 'app-web' },
        { ...(await jose.exportJWK(activityKeyPair.publicKey)), kid: 'service-activity' },
      ],
    }),
  );

  const token = await createServiceToken({
    audience: 'avatar',
    issuer: 'app-web',
    privateKey: activityKeyPair.privateKey,
  });

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    keySet,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects a token whose kid names a different issuer than its iss claim', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({ keys: [{ ...(await jose.exportJWK(keyPair.publicKey)), kid: 'app-web' }] }),
  );

  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: TOKEN_ALGORITHM, kid: 'app-web' })
    .setIssuer('service-activity')
    .setAudience(buildServiceAudience('avatar'))
    .setExpirationTime('60s')
    .sign(keyPair.privateKey);

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    keySet,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects a token carrying no kid header', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({ keys: [{ ...(await jose.exportJWK(keyPair.publicKey)), kid: 'app-web' }] }),
  );

  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: TOKEN_ALGORITHM })
    .setIssuer('app-web')
    .setAudience(buildServiceAudience('avatar'))
    .setExpirationTime('60s')
    .sign(keyPair.privateKey);

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    keySet,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects an expired token', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({ keys: [{ ...(await jose.exportJWK(keyPair.publicKey)), kid: 'app-web' }] }),
  );

  const token = await createServiceToken({
    audience: 'avatar',
    expiresIn: '-1s',
    issuer: 'app-web',
    privateKey: keyPair.privateKey,
  });

  const request = new Request('http://test.local', {
    headers: { authorization: `Bearer ${token}` },
  });

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    keySet,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects a request with no Authorization header', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({ keys: [{ ...(await jose.exportJWK(keyPair.publicKey)), kid: 'app-web' }] }),
  );

  const request = new Request('http://test.local');

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    keySet,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects a non-Bearer Authorization header', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({ keys: [{ ...(await jose.exportJWK(keyPair.publicKey)), kid: 'app-web' }] }),
  );

  const request = new Request('http://test.local', {
    headers: { authorization: 'Basic dXNlcjpwYXNz' },
  });

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    keySet,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});

test('it rejects a garbage token string', async () => {
  const keyPair = await jose.generateKeyPair(TOKEN_ALGORITHM, { extractable: true });

  const keySet = parseServiceJWKS(
    JSON.stringify({ keys: [{ ...(await jose.exportJWK(keyPair.publicKey)), kid: 'app-web' }] }),
  );

  const request = new Request('http://test.local', {
    headers: { authorization: 'Bearer not-a-real-token' },
  });

  const resolution = await verifyServiceToken(request, {
    audience: buildServiceAudience('avatar'),
    keySet,
  });

  expect(resolution).toStrictEqual({ failure: 'invalid-service-token' });
});
