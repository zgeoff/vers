import { buildHeadingPattern } from './build-heading-pattern';

/**
 * Returns the named `##` section of an issue template — its heading through the line before the next
 * `##` heading (or end of file), trailing blank lines trimmed — as a paste-ready block, or null when
 * the template has no such heading.
 */
export function findSectionStub(template: string, title: string): string | null {
  const lines = template.split('\n');
  const headingPattern = buildHeadingPattern(title);
  const start = lines.findIndex((line) => headingPattern.test(line));

  if (start === -1) {
    return null;
  }

  let end = start + 1;

  while (end < lines.length && !/^##\s/.test(lines[end] ?? '')) {
    end += 1;
  }

  return lines.slice(start, end).join('\n').trimEnd();
}
