import type { ResolvedFinding } from './types';

/**
 * Hidden marker on the comment's first line. The bin finds its prior sticky comment by this string,
 * so it must stay identical across the clean and unclean renderings.
 */
export const HYGIENE_MARKER = '<!-- issue-hygiene -->';

/**
 * Renders the sticky hygiene comment: a conversational checklist of the findings, each tied to the
 * rule it enforces and carrying a collapsible paste-ready stub where one applies, or an all-clear
 * acknowledgement when there are no findings. The leading marker lets the bin recognise and update
 * its own comment in place.
 */
export function renderHygieneComment(findings: ReadonlyArray<ResolvedFinding>): string {
  if (findings.length === 0) {
    return `${HYGIENE_MARKER}\n✅ **Issue hygiene: all clear.** Thanks for keeping this one tidy.`;
  }

  return [
    HYGIENE_MARKER,
    "Thanks for opening this! A few tweaks will help it move through triage — here's the checklist:",
    '',
    findings.map((finding) => renderFinding(finding)).join('\n'),
    '',
    "Edit the issue or adjust its labels once you've worked through these, and I'll re-check and update this comment.",
  ].join('\n');
}

function renderFinding(finding: ResolvedFinding): string {
  const line = `- [ ] ${finding.task} — _${finding.rule}_`;

  if (finding.stub === undefined) {
    return line;
  }

  return [line, '', ...renderStub(finding.stub)].join('\n');
}

/**
 * Wraps the stub in a collapsible block indented under its checklist item. The outer fence uses four
 * backticks so a stub that is itself a fenced block (the upkeep trigger line) nests cleanly.
 */
function renderStub(stub: string): Array<string> {
  const indented = stub.split('\n').map((line) => (line === '' ? '' : `  ${line}`));

  return [
    '  <details>',
    '  <summary>Paste-ready stub</summary>',
    '',
    '  ````markdown',
    ...indented,
    '  ````',
    '',
    '  </details>',
  ];
}
