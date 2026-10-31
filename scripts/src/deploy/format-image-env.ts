export function formatImageEnv(refs: Readonly<Record<string, string>>): string {
  return Object.entries(refs)
    .map(([app, ref]) => `IMAGE_${app.toUpperCase().replaceAll('-', '_')}=${ref}\n`)
    .join('');
}
