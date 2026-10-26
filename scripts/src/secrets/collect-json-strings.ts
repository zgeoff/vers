export function collectJSONStrings(value: unknown): Array<string> {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry: unknown) => collectJSONStrings(entry));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((entry: unknown) => collectJSONStrings(entry));
  }

  return [];
}
