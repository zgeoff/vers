export function collectStringValues(value: unknown): Array<string> {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry: unknown) => collectStringValues(entry));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((entry: unknown) => collectStringValues(entry));
  }

  return [];
}
