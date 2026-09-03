export function findStepUpToken(formData: FormData): string | undefined {
  const raw = formData.get('stepUpToken');

  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}
