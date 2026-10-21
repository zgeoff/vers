import { Glob } from 'bun';
import { z } from 'zod';
import { collectTestTimings } from '../test-report/collect-test-timings';
import type { JUnitReport } from '../test-report/types';

// Reads the JUnit report each package's `bun test` wrote on CI and fails when any test took longer
// than 5 s, so a slow test cannot hide behind a raised timeout. Prints the slowest tests either way.

const LIMIT_SECONDS = 5;
const SLOWEST_SHOWN = 10;
const REPORT_FILE = 'test-report.junit.xml';

const rootManifestJSON: unknown = await Bun.file('package.json').json();

const workspacesSchema = z.object({ packages: z.array(z.string()) });
const rootManifestSchema = z.object({ workspaces: workspacesSchema });
const rootManifest = rootManifestSchema.parse(rootManifestJSON);
const reports: Array<JUnitReport> = [];

for (const workspace of rootManifest.workspaces.packages) {
  for await (const path of new Glob(`${workspace}/${REPORT_FILE}`).scan({ cwd: process.cwd() })) {
    reports.push({ path, xml: await Bun.file(path).text() });
  }
}

if (reports.length === 0) {
  console.error(`check-slow-tests: no ${REPORT_FILE} found; run the tests with the junit reporter`);
  process.exit(1);
}

const timings = collectTestTimings(reports);

console.log(`check-slow-tests: ${timings.length} tests in ${reports.length} reports; slowest:`);

for (const timing of timings.slice(0, SLOWEST_SHOWN)) {
  console.log(`  ${timing.seconds.toFixed(3)} s  ${timing.file}  ${timing.name}`);
}

const slow = timings.filter((timing) => timing.seconds > LIMIT_SECONDS);

if (slow.length > 0) {
  console.error(`check-slow-tests: ${slow.length} test(s) over ${LIMIT_SECONDS} s`);

  for (const timing of slow) {
    console.error(`  ${timing.seconds.toFixed(3)} s  ${timing.file}  ${timing.name}`);
  }

  process.exit(1);
}
