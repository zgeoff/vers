import { z } from 'zod';

export const deviceSchema = z.enum(['first', 'second']);
const pageStateSchema = z.strictObject({ url: z.string() });

// The game service crosses from the CLI to the run's supervisor as untyped JSON, so the client
// parses each answer and the service parses each request against this one table.
export const gameServiceContract = {
  readState: {
    args: z.strictObject({ device: deviceSchema }),
    result: z.strictObject({ url: z.string(), state: z.unknown() }),
  },
  navigate: {
    args: z.strictObject({ device: deviceSchema, path: z.string().startsWith('/') }),
    result: pageStateSchema,
  },
  setNetwork: {
    args: z.strictObject({ network: z.enum(['offline', 'online']) }),
    result: z.strictObject({ network: z.enum(['offline', 'online']), workers: z.number().int() }),
  },
  signInSecond: {
    args: z.strictObject({ email: z.string().min(1), password: z.string().min(1) }),
    result: z.strictObject({ url: z.string(), tookOver: z.boolean() }),
  },
  clickSecond: {
    args: z.strictObject({ role: z.string().min(1), name: z.string() }),
    result: pageStateSchema,
  },
  status: {
    args: z.null(),
    result: z.strictObject({ pages: z.number().int() }),
  },
  snapshotSecond: {
    args: z.null(),
    result: z.strictObject({ url: z.string(), snapshot: z.string() }),
  },
};

export type GameMethod = keyof typeof gameServiceContract;

export type GameArgs<Method extends GameMethod> = z.output<
  (typeof gameServiceContract)[Method]['args']
>;

export type GameResult<Method extends GameMethod> = z.output<
  (typeof gameServiceContract)[Method]['result']
>;
