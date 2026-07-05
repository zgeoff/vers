export function combineHeaders(...headers: Array<null | ResponseInit['headers'] | undefined>) {
  const combined = new Headers();

  for (const header of headers) {
    if (!header) {
      continue;
    }

    for (const [key, value] of new Headers(header).entries()) {
      combined.append(key, value);
    }
  }

  return combined;
}
