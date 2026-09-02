import type { ResolvedFinding } from './types';

export const HYGIENE_MARKER = '<!-- issue-hygiene -->';

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
