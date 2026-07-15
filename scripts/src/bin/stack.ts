import { Command } from 'commander';
import { printLogs } from '../stack/commands/print-logs';
import { printStatus } from '../stack/commands/print-status';
import { removeServices } from '../stack/commands/remove-services';
import { runInService } from '../stack/commands/run-in-service';
import { start } from '../stack/commands/start';
import type { StartOptions } from '../stack/commands/start';
import { stop } from '../stack/commands/stop';
import type { ServiceID } from '../stack/types';
import { parseServiceArg } from '../stack/utils/parse-service-arg';

const program = new Command().name('stack').description('CLI to manage the development stack');

program
  .command('start')
  .description('Start services')
  .argument('[service]', 'service to start', parseServiceArg)
  .option('-b, --build', 'build images before starting', false)
  .option('-f, --force-recreate', 'force recreation of containers', false)
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  .action(async (service?: ServiceID, options?: StartOptions) => {
    await start(service, options);
  });

program
  .command('stop')
  .description('Stop services')
  .argument('[service]', 'service to stop', parseServiceArg)
  .action(async (service?: ServiceID) => {
    await stop(service);
  });

program
  .command('rm')
  .description('Remove services')
  .argument('[service]', 'service to remove', parseServiceArg)
  .action(async (service?: ServiceID) => {
    await removeServices(service);
  });

program
  .command('logs')
  .description('Follow service logs')
  .argument('[service]', 'service to follow logs for', parseServiceArg)
  .action(async (service?: ServiceID) => {
    await printLogs(service);
  });

program
  .command('status')
  .description('Show services status')
  .action(async () => {
    await printStatus();
  });

program
  .command('exec')
  .description('Execute a command in a service container')
  .argument('<service>', 'service to execute command in', parseServiceArg)
  .argument('<command...>', 'command to execute')
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  .action(async (service: ServiceID, command: Array<string>) => {
    await runInService(service, command);
  });

program.parse();
