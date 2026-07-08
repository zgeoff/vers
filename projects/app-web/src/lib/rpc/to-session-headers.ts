const SESSION_HEADER_NAMES = ['authorization', 'cookie'] as const;

export function toSessionHeaders(incoming: Headers): Record<string, string> {
  const picked: Record<string, string> = {};

  for (const name of SESSION_HEADER_NAMES) {
    const value = incoming.get(name);

    if (value !== null) {
      picked[name] = value;
    }
  }

  return picked;
}
