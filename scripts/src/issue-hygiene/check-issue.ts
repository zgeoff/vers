import { parseTrigger } from '../upkeep/parse-trigger';
import { buildHeadingPattern } from './build-heading-pattern';
import { collectScopePaths } from './collect-scope-paths';
import type { Finding, IssueShape } from './types';

const EXEMPT_LABELS = new Set(['dep-audit', 'dep-outdated']);

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

const APPROACH_TITLE = 'Approach (unverified)';
const TEMPLATE_DIR = '.github/ISSUE_TEMPLATE';
const BUG_TEMPLATE = `${TEMPLATE_DIR}/bug.md`;
const FEATURE_TEMPLATE = `${TEMPLATE_DIR}/feature.md`;

export function checkIssue(issue: IssueShape): Array<Finding> {
  if (issue.labels.some((label) => EXEMPT_LABELS.has(label))) {
    return [];
  }

  const findings: Array<Finding> = [];

  if (!issue.labels.some((label) => label.startsWith('area/'))) {
    findings.push({
      rule: 'every issue carries an `area/*` label',
      task: 'Add an `area/*` label for the subsystem it touches (e.g. `area/platform`, `area/game`)',
    });
  }

  if (issue.labels.includes('upkeep')) {
    if (issue.milestone !== null) {
      findings.push({
        rule: 'upkeep issues carry no milestone and stay off the delivery board',
        task: 'Remove the milestone',
      });
    }

    if (parseTrigger(issue.body) === null) {
      findings.push({
        rule: 'an upkeep issue opens with a machine-readable trigger line the dep-health sweep evaluates',
        stub: {
          kind: 'literal',
          markdown: '```\ntrigger: date <YYYY-MM-DD>\n```',
        },
        task: 'Add a trigger line (`trigger: date <YYYY-MM-DD>` or `trigger: release <pkg> ><version>`)',
      });
    }

    return findings;
  }

  if (!issue.labels.some((label) => TYPE_LABELS.has(label))) {
    findings.push({
      rule: 'every issue carries a type label',
      task: 'Add a type label (`feature`, `bug`, `chore`, …)',
    });
  }

  const scopePaths = collectScopePaths(issue.body);

  if (scopePaths.length > 0) {
    findings.push({
      rule: 'a Scope bullet states an outcome; a file path belongs in Notes as dated orientation',
      task: `Move ${scopePaths.map((path) => `\`${path}\``).join(', ')} out of \`## Scope\` and into \`## Notes\``,
    });
  }

  if (issue.labels.includes('feature')) {
    if (!hasSection(issue.body, 'Scope')) {
      findings.push({
        rule: 'a feature issue follows its template',
        stub: { kind: 'section', templatePath: FEATURE_TEMPLATE, title: 'Scope' },
        task: 'Add a `## Scope` section listing the behaviors this delivers',
      });
    }

    if (!hasSection(issue.body, APPROACH_TITLE)) {
      findings.push({
        rule: 'a feature issue separates the mechanism it guesses at from the outcome it contracts for',
        stub: { kind: 'section', templatePath: FEATURE_TEMPLATE, title: APPROACH_TITLE },
        task: `Add an \`## ${APPROACH_TITLE}\` section naming the mechanism you expect, or \`none\` where you have no candidate`,
      });
    }

    if (issue.labels.includes('area/game') && !hasSection(issue.body, 'Player story')) {
      findings.push({
        rule: 'every area/game feature carries a `## Player story` section',
        stub: { kind: 'section', templatePath: FEATURE_TEMPLATE, title: 'Player story' },
        task: 'Add a `## Player story` section describing what the player perceives once this ships',
      });
    }
  }

  if (issue.labels.includes('bug')) {
    for (const title of ['Observed', 'Expected', 'Repro']) {
      if (!hasSection(issue.body, title)) {
        findings.push({
          rule: 'a bug issue follows its template',
          stub: { kind: 'section', templatePath: BUG_TEMPLATE, title },
          task: `Add a \`## ${title}\` section`,
        });
      }
    }
  }

  return findings;
}

function hasSection(body: string, title: string): boolean {
  return buildHeadingPattern(title).test(body);
}
