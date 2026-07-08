/** The shared signing/encryption key behind both cookie sessions. */
export function readSessionSecret(): string {
  const secret = process.env['SESSION_SECRET'];

  if (secret === undefined) {
    throw new Error('$SESSION_SECRET is required');
  }

  return secret;
}
