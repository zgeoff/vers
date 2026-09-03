import { buildHeadingPattern } from './build-heading-pattern';

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
