import invariant from 'tiny-invariant';

const BEGIN_MARKER = '<!-- env:begin -->';
const END_MARKER = '<!-- env:end -->';

/**
 * Replaces the content between a README's env markers with the rendered table, leaving
 * everything outside the markers untouched.
 */
export function mergeEnvSection(readme: string, table: string): string {
  const begin = readme.indexOf(BEGIN_MARKER);
  const end = readme.indexOf(END_MARKER);

  invariant(
    begin !== -1 && end > begin,
    `README is missing env markers (${BEGIN_MARKER} … ${END_MARKER})`,
  );

  const before = readme.slice(0, begin + BEGIN_MARKER.length);
  const after = readme.slice(end);

  return `${before}\n\n${table}\n\n${after}`;
}
