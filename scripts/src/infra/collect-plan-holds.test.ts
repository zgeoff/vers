import { expect, test } from 'bun:test';
import { collectPlanHolds } from './collect-plan-holds';

test('it holds nothing in a plan that only creates, updates, reads and refreshes', () => {
  expect(
    collectPlanHolds({
      steps: [
        { op: 'same', urn: 'urn:pulumi:prod::vers-infra::neon:index/project:Project::vers' },
        { op: 'create', urn: 'urn:pulumi:prod::vers-infra::axiom:index/monitor:Monitor::errors' },
        {
          op: 'update',
          urn: 'urn:pulumi:prod::vers-infra::github:index/issueLabel:IssueLabel::bug',
        },
        { op: 'read', urn: 'urn:pulumi:prod::vers-infra::cloudflare:index/zone:Zone::site' },
        { op: 'refresh', urn: 'urn:pulumi:prod::vers-infra::neon:index/role:Role::app' },
      ],
      diagnostics: [],
      changeSummary: { same: 1, create: 1, update: 1 },
    }),
  ).toStrictEqual([]);
});

test.each([
  ['delete'],
  ['replace'],
  ['create-replacement'],
  ['delete-replaced'],
  ['discard'],
  ['import'],
  ['remove-pending-replace'],
])('it holds a %s step', (op) => {
  expect(
    collectPlanHolds({
      steps: [{ op, urn: 'urn:pulumi:prod::vers-infra::neon:index/branch:Branch::main' }],
      diagnostics: [],
      changeSummary: {},
    }),
  ).toStrictEqual([`${op} urn:pulumi:prod::vers-infra::neon:index/branch:Branch::main`]);
});

test('it holds an op that it does not know', () => {
  expect(
    collectPlanHolds({
      steps: [{ op: 'transplant', urn: 'urn:pulumi:prod::vers-infra::neon:index/role:Role::app' }],
      diagnostics: [],
      changeSummary: {},
    }),
  ).toStrictEqual(['transplant urn:pulumi:prod::vers-infra::neon:index/role:Role::app']);
});

test('it holds each step of a plan that replaces one resource', () => {
  expect(
    collectPlanHolds({
      steps: [
        {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::vers-infra::cloudflare:index/dnsRecord:DnsRecord::apex',
        },
        {
          op: 'replace',
          urn: 'urn:pulumi:prod::vers-infra::cloudflare:index/dnsRecord:DnsRecord::apex',
        },
        {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::vers-infra::cloudflare:index/dnsRecord:DnsRecord::apex',
        },
      ],
      diagnostics: [],
      changeSummary: { replace: 1 },
    }),
  ).toStrictEqual([
    'create-replacement urn:pulumi:prod::vers-infra::cloudflare:index/dnsRecord:DnsRecord::apex',
    'replace urn:pulumi:prod::vers-infra::cloudflare:index/dnsRecord:DnsRecord::apex',
    'delete-replaced urn:pulumi:prod::vers-infra::cloudflare:index/dnsRecord:DnsRecord::apex',
  ]);
});

test('it holds a delete that only the change summary counts', () => {
  expect(
    collectPlanHolds({ steps: [], diagnostics: [], changeSummary: { same: 3, delete: 2 } }),
  ).toStrictEqual(["the plan's summary counts 2 delete"]);
});
