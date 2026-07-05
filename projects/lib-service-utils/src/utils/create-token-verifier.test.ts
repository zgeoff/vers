import { createTestJWT } from '@vers/service-test-utils';
import * as jose from 'jose';
import { expect, test } from 'vitest';
import { createTokenVerifier } from './create-token-verifier';

const TEST_TOKEN_PAYLOAD = {
  iss: `https://test.com/`,
  sub: 'test_id',
};

const TEST_PKCS8_PRIVKEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC+ItgiAjP9V8TH
7hnovReRDXi5F7jE5jKBHnjKuqESoFqqubNVkDfkeTnuEFffyQI6x8rMR6Fng7ta
XJWEK7Qg1ugJwrAAYXgnYijgyFaMbVZUd/FLBld5wouOIdz4/OK8r4unS9X5tUxw
YyqyvRTWThzBaKlEXONKt4HHGpQij0PZSa26yZMNgC0A6k9ovzM+eBpQI3zoTg97
5+CtE4A4DvekSsa/zjzqN23cf/zgvAdPvCz4YO1wI0/uDeq9lC1Q8ZEqHgYydwZp
8mgwszyuyK8O1blHPwnfMPtrO4woyVpG+Dp4U7f3yMLkPuCQZPolHhvxFcyXhP2f
o94orOwpAgMBAAECggEANUcWQRFU+Bxr64nwgKLbw61+sn7PK31FkaC0QDpjgBCm
10gJ1GQBBWhiry6tMOvmUApD7VH1DEiBaySeUNbeNoWBp5qCLtkhDggXZEU+20KX
+jtRxbAVOu0kpcMfZDWYYz7dZxd88ee3b5aaFFOfTx28OQXWyG0u03TwTJZKBBSc
oVST3sZOFxhMHMudwzhtN50k29SeI/qi4ZMn1QpcQEUYqWQt1Ja5gXz4FfHmta72
DbFD1IPdSa5tHKCDfr7pHvi2RUWyPCo7Zxzf1QkDQC+p+U8LSQoqKrDotuHOpfIS
QQTzWuEMkBv/HnUh/9DFD3wpm057bbRCk8Zxl7Di8QKBgQD05KmST+evq14eTVqM
EYqpYZVrRYgN9PnPtkkdUlsUHxiOSpv9rE+jJk1cjlv8/fxR+LHg0wczLWJRLHrJ
X4vibzXdPXESRf9gVqBMq0Cpg2Fzmp7nr+DjNT7S5q8VcWxRcAmKnMZgeg01NxgT
A8Kbsp3kO2T4vntoPN3tXpwSywKBgQDGwmxmUF2N/kl938i3JSgnRr5D2syWXYsi
U7otk62H4r5qCmDl1phx1lY493W8iCtUzuF1fvaPFHncTxL9Poyr75ebpATlLUFm
J4CgioKTCpMyoU+RhTmjchYFZB3Bm2q/v81ysJw84HphFsKJrLbSNEEUpK6rpC4a
boZMQ4j6WwKBgBCzCxEsG7tx7yAX3EXS6Ga2fc7r1eRFwUc1wfSa6hUMLct+MPby
ahfRA9N87a7pzuv0DoUrPsFxpdOtOc5DkrFlLgIhL3W0ij6SianQv78Pc3TDpXRd
HPPBbMBK9MN8kYtYHX5zRF/N0tq/IAgj6IBfhL7Mgg0oSBgKloOaQQBTAoGALRXZ
JPRB5H20CfuDOhgRnacsbZPqKImbj/PSHZiMGnDSpJcqF7iv59KoyE9Jw7RXr+sl
tVNRdm88nT7KnetcWXwFteZkvd+gIB4BzWjd6aDSdv+kXuwLgQnV+O8W2N36Pvix
D70EE8MPv4o8IqKs7c2wnZAllwWs943upMoE/lUCgYEA23o/1XGkqlD4wvamdkRC
MedMlmncDnEZ2VTc8JRPJgqJzNCQauQYZM3mVLBprADJ7Hq45KDywvC0Xr7gGl40
7FrlLPCPZvQEx6gObQ/6o3WFF0WGkUJXXBwk8cG2hSy4HOMDsfg1BZ1Kmpm0MaOe
LM20jo/N1GQ44yrgb9j6U7s=
-----END PRIVATE KEY-----
`;

const TEST_SPKI_PUBKEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAviLYIgIz/VfEx+4Z6L0X
kQ14uRe4xOYygR54yrqhEqBaqrmzVZA35Hk57hBX38kCOsfKzEehZ4O7WlyVhCu0
INboCcKwAGF4J2Io4MhWjG1WVHfxSwZXecKLjiHc+PzivK+Lp0vV+bVMcGMqsr0U
1k4cwWipRFzjSreBxxqUIo9D2UmtusmTDYAtAOpPaL8zPngaUCN86E4Pe+fgrROA
OA73pErGv8486jdt3H/84LwHT7ws+GDtcCNP7g3qvZQtUPGRKh4GMncGafJoMLM8
rsivDtW5Rz8J3zD7azuMKMlaRvg6eFO398jC5D7gkGT6JR4b8RXMl4T9n6PeKKzs
KQIDAQAB
-----END PUBLIC KEY-----
`;

const verifyToken = createTokenVerifier({
  audience: 'test.com',
  issuer: 'https://test.com/',
  spkiKey: TEST_SPKI_PUBKEY,
});

test('it authorizes a valid token and extracts the payload', async () => {
  const signingKey = await jose.importPKCS8(TEST_PKCS8_PRIVKEY, 'RS256');

  const token = await createTestJWT({
    audience: 'test.com',
    issuer: 'https://test.com/',
    pkcs8Key: signingKey,
    sub: TEST_TOKEN_PAYLOAD.sub,
  });

  const payload = await verifyToken(token);

  expect(payload).toStrictEqual(TEST_TOKEN_PAYLOAD);
});

test('should throws an error if no token is provided', async () => {
  await expect(verifyToken('')).rejects.toThrow('Invalid Compact JWS');
});

test('should throws an error if an invalid token is provided', async () => {
  await expect(verifyToken('abc123')).rejects.toThrow('Invalid Compact JWS');
});
