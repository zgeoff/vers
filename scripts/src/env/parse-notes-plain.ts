import { z } from 'zod';

const opItemFieldSchema = z.object({ label: z.string(), value: z.string().optional() });

const opItemSchema = z.object({
  fields: z.array(opItemFieldSchema),
});

// reads `notesPlain` from `op item get --format json` output: `--fields` CSV-quotes multiline
// values and corrupts PEM keys and JSON blobs
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
