import { expect, test } from 'bun:test';
import { formatSummarySection } from './format-summary-section';

test('it renders the heading and the body in a fenced block of the given language', () => {
  expect(
    formatSummarySection({
      heading: 'Pulumi preview (prod)',
      language: 'text',
      body: 'no changes\n',
    }),
  ).toBe('## Pulumi preview (prod)\n\n```text\nno changes\n```\n');
});

test('it closes the fence on its own line when the body has no final newline', () => {
  expect(formatSummarySection({ heading: 'bun outdated', language: '', body: 'zod 4.1 4.2' })).toBe(
    '## bun outdated\n\n```\nzod 4.1 4.2\n```\n',
  );
});
