import * as z from 'zod';

const RecordsSchema = z.array(z.unknown());

export function readQARecords(storage: Storage, key: string): ReadonlyArray<unknown> {
  const stored = storage.getItem(key);

  if (stored === null) {
    return [];
  }

  try {
    const parsed = RecordsSchema.safeParse(JSON.parse(stored));

    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
