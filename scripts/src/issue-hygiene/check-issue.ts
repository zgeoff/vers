import { parseTrigger } from '../upkeep/parse-trigger';
import type { IssueShape } from './types';

/**
 * Labels for issues the dep-health sweep creates and manages itself; their bodies are generated
 * reports, so the shape rules don't apply.
 */
const EXEMPT_LABELS = new Set(['dep-audit', 'dep-outdated']);
const PRIORITY_LABELS = new Set(['p0-critical', 'p1-high', 'p2-medium']);

const TYPE_LABELS = new Set([
  'bug',
  'chore',
  'documentation',
  'epic',
  'feature',
  'game-design',
  'refactor',
  'research',
  'spike',
]);

/**
 * Evaluates an issue against the repository's issue-shape rules — required area, type, and priority
 * labels, a delivery milestone, and the type-specific body sections. Returns one human-readable
 * finding per violated rule, empty when the issue is clean.
 */
export function checkIssue(issue: IssueShape): Array<string> {
  if (issue.labels.some((label) => EXEMPT_LABELS.has(label))) {
    return [];
  }

  const findings: Array<string> = [];

  if (!issue.labels.some((label) => label.startsWith('area/'))) {
    findings.push('missing an `area/*` label');
  }

  if (issue.labels.includes('upkeep')) {
    if (issue.milestone !== null) {
      findings.push('upkeep issues carry no milestone — remove it');
    }

    if (parseTrigger(issue.body) === null) {
      findings.push(
        'body carries no parseable trigger line (`trigger: date <YYYY-MM-DD>` or `trigger: release <pkg> ><version>`)',
      );
    }

    return findings;
  }

  if (!issue.labels.some((label) => TYPE_LABELS.has(label))) {
    findings.push('missing a type label (feature, bug, chore, …)');
  }

  if (!issue.labels.some((label) => PRIORITY_LABELS.has(label))) {
    findings.push('missing a priority label (`p0-critical`, `p1-high`, `p2-medium`)');
  }

  if (issue.milestone === null) {
    findings.push('missing the delivery-phase milestone');
  }

  if (issue.labels.includes('feature')) {
    if (!hasSection(issue.body, 'Scope')) {
      findings.push('missing a `## Scope` section');
    }

    if (issue.labels.includes('area/game') && !hasSection(issue.body, 'Player story')) {
      findings.push('missing a `## Player story` section (required for area/game features)');
    }
  }

  if (issue.labels.includes('bug')) {
    for (const section of ['Observed', 'Expected', 'Repro']) {
      if (!hasSection(issue.body, section)) {
        findings.push(`missing a \`## ${section}\` section`);
      }
    }
  }

  return findings;
}

function hasSection(body: string, title: string): boolean {
  return new RegExp(`^##\\s+${title}\\s*$`, 'im').test(body);
}
