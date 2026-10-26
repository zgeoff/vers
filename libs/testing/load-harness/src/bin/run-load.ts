import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { runCommandLine } from '@vers/scripts';
import { define } from 'gunshi';
import { LOAD_RUN_ARGS } from '../load-run-args';
import { parseCountListOption } from '../parse-count-list-option';
import { runLoad } from '../run-load';

const RESULTS_ROOT = path.resolve(import.meta.dirname, '../../../../../.load-results');

const entry = define({
  name: 'load',
  description:
    'run the isolated load scenarios against the production images and write a capacity report',
  args: LOAD_RUN_ARGS,
  run: async (ctx) => {
    const options = ctx.values;
    const outDir = path.join(RESULTS_ROOT, new Date().toISOString().replaceAll(':', '-'));
    const logPath = path.join(outDir, 'run.log');

    mkdirSync(outDir, { recursive: true });

    const log = (line: string): void => {
      const stamped = `${new Date().toISOString()} ${line}`;

      console.log(stamped);

      appendFileSync(logPath, `${stamped}\n`);
    };

    const result = await runLoad({
      cpuProfile: options['cpu-profile'],
      log,
      offlineHours: options['offline-hours'],
      offlinePlayers: options['offline-players'],
      outageMinutes: options['outage-minutes'],
      outageService: options['outage-service'],
      outDir,
      recoveryPlayers: options['recovery-players'],
      retainedEvery: options['retained-every'],
      scenario: options.scenario,
      settlementTargetSeconds: options['settlement-target-seconds'],
      skipBuild: options['skip-build'],
      steadyMinutes: options['steady-minutes'],
      steadyPlayers: parseCountListOption(options['steady-players']),
    });

    log(`report: ${result.reportPath}`);

    for (const failure of result.containerFailures) {
      log(`failed: ${failure}`);
    }

    if (result.containerFailures.length > 0) {
      process.exitCode = 1;
    }
  },
});

try {
  const ran = await runCommandLine(process.argv.slice(2), entry, { output: console });

  if (!ran) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`load: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
