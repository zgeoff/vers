interface MockJWTPayload {
  exp: number;
  sub: string;
}

/**
 * Encodes a mock JWT in Base64
 * @param payload - The payload to encode
 * @returns The encoded JWT
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function encodeMockJWT(payload: MockJWTPayload): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = btoa(JSON.stringify(header));

  return `${encodedHeader}.${btoa(JSON.stringify(payload))}`;
}
