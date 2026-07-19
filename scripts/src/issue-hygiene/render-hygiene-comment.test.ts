import { expect, test } from 'bun:test';
import { renderHygieneComment } from './render-hygiene-comment';

test('it renders an all-clear acknowledgement when there are no findings', () => {
  expect(renderHygieneComment([])).toBe(
    '<!-- issue-hygiene -->\n✅ **Issue hygiene: all clear.** Thanks for keeping this one tidy.',
  );
});

test('it renders a stubless finding as a single checklist line tied to its rule', () => {
  const comment = renderHygieneComment([
    { rule: 'every issue carries a type label', task: 'Add a type label' },
  ]);

  expect(comment).toBe(
    [
      '<!-- issue-hygiene -->',
      "Thanks for opening this! A few tweaks will help it move through triage — here's the checklist:",
      '',
      '- [ ] Add a type label — _every issue carries a type label_',
      '',
      "Edit the issue or adjust its labels once you've worked through these, and I'll re-check and update this comment.",
    ].join('\n'),
  );
});

test('it nests a section stub in a collapsible block under its checklist item', () => {
  const comment = renderHygieneComment([
    {
      rule: 'a bug issue follows its template',
      stub: '## Repro\n\n<!-- numbered steps -->',
      task: 'Add a `## Repro` section',
    },
  ]);

  expect(comment).toInclude(
    [
      '- [ ] Add a `## Repro` section — _a bug issue follows its template_',
      '',
      '  <details>',
      '  <summary>Paste-ready stub</summary>',
      '',
      '  ````markdown',
      '  ## Repro',
      '',
      '  <!-- numbered steps -->',
      '  ````',
      '',
      '  </details>',
    ].join('\n'),
  );
});

test('it nests a fenced literal stub without colliding with the outer fence', () => {
  const comment = renderHygieneComment([
    {
      rule: 'an upkeep issue opens with a trigger line',
      stub: '```\ntrigger: date <YYYY-MM-DD>\n```',
      task: 'Add a trigger line',
    },
  ]);

  expect(comment).toInclude(
    ['  ````markdown', '  ```', '  trigger: date <YYYY-MM-DD>', '  ```', '  ````'].join('\n'),
  );
});
