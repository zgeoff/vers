export async function digestCorpus(canonical: string): Promise<string> {
  const digestBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));

  return [...new Uint8Array(digestBuffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
