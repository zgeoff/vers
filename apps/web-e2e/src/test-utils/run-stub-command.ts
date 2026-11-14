import { appendFile } from 'node:fs/promises';
import { z } from 'zod';

// A stand-in for a CLI, such as `docker` or `bunx`, that a shim on PATH runs as
// `bun run-stub-command.ts <name> <args...>`. It logs each call, then answers from a map keyed by
// `<name> <first arg>`, or by `<name>` alone. A call with no answer exits 0 and prints nothing.

const answerSchema = z.object({
  stdout: z.string().optional(),
  exitCode: z.number().int().optional(),
  delayMs: z.number().int().optional(),
});

const answersSchema = z.record(z.string(), answerSchema);
const [name = '', ...args] = process.argv.slice(2);
const answers = answersSchema.parse(JSON.parse(process.env['STUB_COMMAND_ANSWERS'] ?? '{}'));

await appendFile(
  process.env['STUB_COMMAND_LOG'] ?? '/dev/null',
  `${JSON.stringify({ name, args })}\n`,
);

const answer = answers[`${name} ${args[0] ?? ''}`] ?? answers[name] ?? {};

await Bun.sleep(answer.delayMs ?? 0);

const stdout = answer.stdout === undefined ? '' : `${answer.stdout}\n`;

process.stdout.write(stdout);
process.exit(answer.exitCode ?? 0);
