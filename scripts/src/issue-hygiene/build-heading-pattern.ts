/**
 * Builds the pattern matching a markdown `##` heading carrying the given title, case-insensitively.
 */
export function buildHeadingPattern(title: string): RegExp {
  // a title carrying parentheses would otherwise compile as a capture group, matching a heading the
  // issue never wrote
  const literal = title.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);

  return new RegExp(`^##\\s+${literal}\\s*$`, 'im');
}
