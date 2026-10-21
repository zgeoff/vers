import { expect, test } from 'bun:test';
import { collectTestTimings } from './collect-test-timings';

test('it roots each test file at the package that wrote the report', () => {
  const xml = [
    '<testsuites name="bun test" tests="1">',
    '  <testsuite name="src/parse-route.test.ts" file="src/parse-route.test.ts" tests="1">',
    '    <testcase name="it parses a bare path" classname="" time="0.012" file="src/parse-route.test.ts" line="4" assertions="1" />',
    '  </testsuite>',
    '</testsuites>',
  ].join('\n');

  expect(
    collectTestTimings([{ path: 'libs/core/router/test-report.junit.xml', xml }]),
  ).toStrictEqual([
    {
      file: 'libs/core/router/src/parse-route.test.ts',
      name: 'it parses a bare path',
      seconds: 0.012,
    },
  ]);
});

test('it orders the tests of every report slowest first', () => {
  const first = [
    '<testsuites>',
    '  <testcase name="it reads a short list" classname="" time="0.4" file="src/read-list.test.ts" line="3" />',
    '  <testcase name="it reads a long list" classname="" time="6.25" file="src/read-list.test.ts" line="9" />',
    '</testsuites>',
  ].join('\n');

  const second = [
    '<testsuites>',
    '  <testcase name="it sends a receipt" classname="" time="1.5" file="src/send-receipt.test.ts" line="5" />',
    '</testsuites>',
  ].join('\n');

  expect(
    collectTestTimings([
      { path: 'services/ledger/test-report.junit.xml', xml: first },
      { path: 'services/mailer/test-report.junit.xml', xml: second },
    ]),
  ).toStrictEqual([
    { file: 'services/ledger/src/read-list.test.ts', name: 'it reads a long list', seconds: 6.25 },
    { file: 'services/mailer/src/send-receipt.test.ts', name: 'it sends a receipt', seconds: 1.5 },
    { file: 'services/ledger/src/read-list.test.ts', name: 'it reads a short list', seconds: 0.4 },
  ]);
});

test('it decodes the XML entities in a test name', () => {
  const xml =
    '<testcase name="it keeps &quot;a &amp; b&quot; &lt;intact&gt;" classname="" time="0.1" file="src/quote.test.ts" line="1" />';

  expect(collectTestTimings([{ path: 'test-report.junit.xml', xml }])).toStrictEqual([
    { file: 'src/quote.test.ts', name: 'it keeps "a & b" <intact>', seconds: 0.1 },
  ]);
});

test('it collects no tests from a report with none', () => {
  const xml = '<testsuites name="bun test" tests="0" time="0"></testsuites>';

  expect(
    collectTestTimings([{ path: 'libs/core/empty/test-report.junit.xml', xml }]),
  ).toStrictEqual([]);
});
