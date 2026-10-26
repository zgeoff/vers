import { define } from 'gunshi';
import { printLogs } from '../stack/commands/print-logs';
import { printStatus } from '../stack/commands/print-status';
import { removeServices } from '../stack/commands/remove-services';
import { runInService } from '../stack/commands/run-in-service';
import { start } from '../stack/commands/start';
import { stop } from '../stack/commands/stop';
import { STACK_ARGS } from '../stack/stack-args';
import { runCommandLine } from '../utils/run-command-line';

const startCommand = define({
  name: 'start',
  description: 'Start services',
  args: STACK_ARGS.start,
  run: async (ctx) => {
    await start(ctx.values.service, {
      build: ctx.values.build,
      forceRecreate: ctx.values['force-recreate'],
    });
  },
});

const stopCommand = define({
  name: 'stop',
  description: 'Stop services',
  args: STACK_ARGS.stop,
  run: async (ctx) => {
    await stop(ctx.values.service);
  },
});

const rmCommand = define({
  name: 'rm',
  description: 'Remove services',
  args: STACK_ARGS.rm,
  run: async (ctx) => {
    await removeServices(ctx.values.service);
  },
});

const logsCommand = define({
  name: 'logs',
  description: 'Follow service logs',
  args: STACK_ARGS.logs,
  run: async (ctx) => {
    await printLogs(ctx.values.service);
  },
});

const statusCommand = define({
  name: 'status',
  description: 'Show services status',
  run: async () => {
    await printStatus();
  },
});

const execCommand = define({
  name: 'exec',
  description: 'Execute a command in a service container',
  args: STACK_ARGS.exec,
  run: async (ctx) => {
    const command = [...(ctx.values.command ?? []), ...ctx.rest];

    if (command.length === 0) {
      console.error('stack exec: name the command to execute');

      process.exitCode = 1;

      return;
    }

    await runInService(ctx.values.service, command);
  },
});

const entry = define({ name: 'stack', description: 'CLI to manage the development stack' });

const ran = await runCommandLine(process.argv.slice(2), entry, {
  output: console,
  subCommands: {
    exec: execCommand,
    logs: logsCommand,
    rm: rmCommand,
    start: startCommand,
    status: statusCommand,
    stop: stopCommand,
  },
});

if (!ran) {
  process.exitCode = 1;
}
