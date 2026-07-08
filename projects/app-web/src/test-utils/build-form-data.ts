/** Builds a `FormData` from a flat field map, mirroring a form submission's payload. */
export function buildFormData(fields: Readonly<Record<string, string>>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}
