import { z } from 'zod';

const fieldSchema = z.object({ label: z.string().optional(), value: z.string().optional() });
const opItemSchema = z.object({ fields: z.array(fieldSchema) });

export function findOpFieldValue(rawItem: unknown, labels: ReadonlyArray<string>): string | null {
  const parsed = opItemSchema.safeParse(rawItem);

  if (!parsed.success) {
    return null;
  }

  for (const label of labels) {
    const value = parsed.data.fields.find((field) => field.label === label)?.value;

    if (value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
}
