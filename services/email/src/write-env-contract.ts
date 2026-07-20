import { runEnvContractCLI } from '@vers/service-runtime';
import { envShape } from './env-shape';

process.exitCode = await runEnvContractCLI({
  args: process.argv.slice(2),
  dir: new URL('..', import.meta.url),
  envShape,
});
