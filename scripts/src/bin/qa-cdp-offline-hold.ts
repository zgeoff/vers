import { define } from 'gunshi';
import { ENDPOINT_ARG } from '../qa/endpoint-arg';
import { withTargetClient } from '../qa/with-target-client';
import { runCommandLine } from '../utils/run-command-line';

const OFFLINE_CONDITIONS = {
  downloadThroughput: -1,
  latency: 0,
  offline: true,
  uploadThroughput: -1,
};

const STOP_SIGNALS = ['SIGHUP', 'SIGINT', 'SIGTERM'] as const;

const entry = define({
  name: 'qa-cdp-offline-hold',
  description: 'keep a page or worker target offline until this process stops or the target closes',
  args: {
    endpoint: { ...ENDPOINT_ARG, required: true },
    target: { description: 'target id', type: 'positional' },
  },
  run: async (ctx) => {
    const targetID = ctx.values.target;
    const stopped = Promise.withResolvers<void>();

    for (const signal of STOP_SIGNALS) {
      process.once(signal, () => {
        stopped.resolve();
      });
    }

    await withTargetClient(ctx.values.endpoint, targetID, async (target) => {
      await target.send('Network.enable');
      await target.send('Network.emulateNetworkConditions', OFFLINE_CONDITIONS);

      // Chrome drops network emulation when the session that set it detaches, so the session
      // stays open until the hold stops
      console.log(`held ${targetID}`);

      await Promise.race([target.closed, stopped.promise]);
    });
  },
});

try {
  const ran = await runCommandLine(process.argv.slice(2), entry, { output: console });

  if (!ran) {
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exit(1);
}
