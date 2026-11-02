import { expect, test } from 'bun:test';
import { formatPlanReport } from './format-plan-report';

test('it reports a passed plan with a table of the steps that change a resource', () => {
  expect(
    formatPlanReport({
      holds: [],
      outcome: 'apply',
      steps: [
        { op: 'same', urn: 'urn:pulumi:prod::vers-infra::neon:index/project:Project::vers' },
        {
          op: 'update',
          urn: 'urn:pulumi:prod::vers-infra::github:index/issueLabel:IssueLabel::bug',
        },
      ],
    }),
  ).toBe(
    [
      '## Apply plan (prod)',
      '',
      'The guard passed the plan, so the job applies it.',
      '',
      '| Op | Resource |',
      '| --- | --- |',
      '| `update` | `urn:pulumi:prod::vers-infra::github:index/issueLabel:IssueLabel::bug` |',
      '',
    ].join('\n'),
  );
});

test('it reports a held plan with each reason and the command that applies it', () => {
  expect(
    formatPlanReport({
      holds: [
        'the preview before this change found drift or an earlier held change',
        'delete urn:pulumi:prod::vers-infra::neon:index/role:Role::reader',
      ],
      outcome: 'held',
      steps: [{ op: 'delete', urn: 'urn:pulumi:prod::vers-infra::neon:index/role:Role::reader' }],
    }),
  ).toBe(
    [
      '## Apply plan (prod)',
      '',
      'The guard held the plan for a person, for these reasons:',
      '',
      '- the preview before this change found drift or an earlier held change',
      '- delete urn:pulumi:prod::vers-infra::neon:index/role:Role::reader',
      '',
      "To apply the plan of main's tip, dispatch the workflow: `gh workflow run infra-deploy.yml --ref main`",
      '',
      '| Op | Resource |',
      '| --- | --- |',
      '| `delete` | `urn:pulumi:prod::vers-infra::neon:index/role:Role::reader` |',
      '',
    ].join('\n'),
  );
});

test('it reports the holds of a dispatched run that applies them', () => {
  expect(
    formatPlanReport({
      holds: ['delete urn:pulumi:prod::vers-infra::neon:index/role:Role::reader'],
      outcome: 'apply',
      steps: [{ op: 'delete', urn: 'urn:pulumi:prod::vers-infra::neon:index/role:Role::reader' }],
    }),
  ).toBe(
    [
      '## Apply plan (prod)',
      '',
      'The guard held the plan for these reasons, and the job applies it because a person dispatched the run:',
      '',
      '- delete urn:pulumi:prod::vers-infra::neon:index/role:Role::reader',
      '',
      '| Op | Resource |',
      '| --- | --- |',
      '| `delete` | `urn:pulumi:prod::vers-infra::neon:index/role:Role::reader` |',
      '',
    ].join('\n'),
  );
});

test('it says when the plan changes no resource', () => {
  expect(
    formatPlanReport({
      holds: [],
      outcome: 'apply',
      steps: [{ op: 'same', urn: 'urn:pulumi:prod::vers-infra::neon:index/project:Project::vers' }],
    }),
  ).toBe(
    [
      '## Apply plan (prod)',
      '',
      'The guard passed the plan, so the job applies it.',
      '',
      'The plan changes no resource.',
      '',
    ].join('\n'),
  );
});
