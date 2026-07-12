import { z } from 'zod';

const opItemFieldSchema = z.object({ label: z.string(), value: z.string().optional() });

const opItemSchema = z.object({
  fields: z.array(opItemFieldSchema),
});

/**
 * Extracts an item's `notesPlain` field value from `op item get --format
 * json` output — the only field-read path that preserves multiline values
 * (PEM keys, JSON blobs) verbatim. `op item get --fields` CSV-quotes
 * multiline values and corrupts them.
 */
export function parseNotesPlain(raw: unknown, itemTitle: string): string {
  const result = opItemSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(`item "${itemTitle}" did not return the expected op item JSON shape`);
  }

  const field = result.data.fields.find((candidate) => candidate.label === 'notesPlain');

  if (field?.value === undefined) {
    throw new Error(`item "${itemTitle}" has no notesPlain field`);
  }

  return field.value;
}
