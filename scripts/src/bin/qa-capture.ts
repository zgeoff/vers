import { define } from 'gunshi';
import { QA_CAPTURE_ARGS } from '../qa/qa-capture-args';
import { resolveEndpoint } from '../qa/resolve-endpoint';
import { startWorkerCapture } from '../qa/start-worker-capture';
import { runCommandLine } from '../utils/run-command-line';

const entry = define({
  name: 'qa-capture',
  description: "log every shared worker's RPC requests and responses from a debug Chrome",
  args: QA_CAPTURE_ARGS,
  run: (ctx) => {
    const endpoint = resolveEndpoint(ctx.values.endpoint, process.env['QA_CDP_ENDPOINT']);
    const workerURL = ctx.values['worker-url'];

    printLine(`capture start endpoint=${endpoint} path=${ctx.values.path}`);

    const stop = startWorkerCapture({
      endpoint,
      pathFilter: ctx.values.path,
      print: printLine,
      ...(workerURL !== undefined && { workerURL }),
    });

    process.once('SIGINT', () => {
      stop();

      process.exit(0);
    });
  },
});

try {
  const ran = await runCommandLine(process.argv.slice(2), entry, { output: console });

  if (!ran) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`qa-capture: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

function printLine(line: string): void {
  console.log(`${new Date().toISOString()} ${line}`);
}
