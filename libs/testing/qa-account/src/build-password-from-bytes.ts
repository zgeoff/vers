const MIN_ENTROPY_BYTES = 16;

export function buildPasswordFromBytes(bytes: Uint8Array): string {
  if (bytes.length < MIN_ENTROPY_BYTES) {
    throw new Error(`a generated password needs at least ${MIN_ENTROPY_BYTES} bytes of entropy`);
  }

  return Buffer.from(bytes).toString('base64url');
}
