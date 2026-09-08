import { Command } from 'commander';
import { buildEndpointOption } from '../qa/build-endpoint-option';
import { startWorkerCapture } from '../qa/start-worker-capture';

const DEFAULT_PATH_FILTER = '/api/rpc/';

interface CaptureOptions {
  readonly endpoint: string;
  readonly path: string;
  readonly workerUrl?: string;
}

const program = new Command()
  .name('qa-capture')
  .description("log every shared worker's RPC requests and responses from a debug Chrome")
  .addOption(buildEndpointOption())
  .option('--path <substring>', 'log only requests whose url contains this', DEFAULT_PATH_FILTER)
  .option('--worker-url <substring>', 'attach only to shared workers whose url contains this')
  .action((options: CaptureOptions) => {
    printLine(`capture start endpoint=${options.endpoint} path=${options.path}`);

    const stop = startWorkerCapture({
      endpoint: options.endpoint,
      pathFilter: options.path,
      print: printLine,
      ...(options.workerUrl !== undefined && { workerURL: options.workerUrl }),
    });

    process.once('SIGINT', () => {
      stop();

      process.exit(0);
    });
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(`qa-capture: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

function printLine(line: string): void {
  console.log(`${new Date().toISOString()} ${line}`);
}
