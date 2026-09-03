import type { z } from 'zod';

export function toFieldErrors<Field extends string>(
  error: z.ZodError,
  fields: ReadonlyArray<Field>,
): Partial<Record<Field, string>> {
  const fieldErrors: Partial<Record<Field, string>> = {};

  for (const issue of error.issues) {
    const [field] = issue.path;

    if (isListedField(field, fields) && !(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

function isListedField<Field extends string>(
  value: unknown,
  fields: ReadonlyArray<Field>,
): value is Field {
  const listed: ReadonlyArray<string> = fields;

  return typeof value === 'string' && listed.includes(value);
}
