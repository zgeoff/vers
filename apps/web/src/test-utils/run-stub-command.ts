import { z } from 'zod';

const answerSchema = z.object({
  stdout: z.string().optional(),
  exitCode: z.number().int().optional(),
  delayMs: z.number().int().optional(),
});

const answersSchema = z.record(z.string(), answerSchema);
const [name = '', ...args] = process.argv.slice(2);
const answers = answersSchema.parse(JSON.parse(process.env['STUB_COMMAND_ANSWERS'] ?? '{}'));
const answer = answers[`${name} ${args[0] ?? ''}`] ?? answers[name] ?? {};

await Bun.sleep(answer.delayMs ?? 0);

const stdout = answer.stdout === undefined ? '' : `${answer.stdout}\n`;

process.stdout.write(stdout);
process.exit(answer.exitCode ?? 0);
