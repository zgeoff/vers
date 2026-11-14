import type { ServiceCaller } from '@wringer/core';
import { defineDriver } from '@wringer/core';
import { z } from 'zod';
import { gameServiceContract } from './game-service-contract';
import type { GameArgs, GameMethod, GameResult } from './game-service-contract';
import { startGameBridge } from './start-game-bridge';

export interface GameClient {
  readonly readState: (args: GameArgs<'readState'>) => Promise<GameResult<'readState'>>;
  readonly navigate: (args: GameArgs<'navigate'>) => Promise<GameResult<'navigate'>>;
  readonly setNetwork: (args: GameArgs<'setNetwork'>) => Promise<GameResult<'setNetwork'>>;
  readonly signInSecond: (args: GameArgs<'signInSecond'>) => Promise<GameResult<'signInSecond'>>;
  readonly clickSecond: (args: GameArgs<'clickSecond'>) => Promise<GameResult<'clickSecond'>>;
  readonly snapshotSecond: () => Promise<GameResult<'snapshotSecond'>>;
}

const optionsSchema = z.strictObject({
  devtoolsPort: z.number().int().positive(),
  actionTimeoutMs: z.number().int().positive().default(15_000),
});

const targetConfigSchema = z.strictObject({ endpoint: z.string().min(1).default('web') });

// What the browser driver can't do to vers's game: read the writer worker's state through the
// page's QA hook, move the client router, cut the network for the page and its SharedWorker, and
// play a second device in a browser context of its own.
export const game = defineDriver({
  name: 'game',
  options: optionsSchema,
  targetConfig: targetConfigSchema,
  services: {
    bridge: {
      start: (ctx) =>
        startGameBridge({
          devtoolsURL: `http://127.0.0.1:${ctx.options.devtoolsPort}`,
          webURL: String(ctx.endpoints[ctx.config.endpoint]),
          actionTimeoutMs: ctx.options.actionTimeoutMs,
        }),
    },
  },
  client: (session, fence): GameClient => {
    const bridge = session.service('bridge');

    const call = <Method extends GameMethod>(method: Method, effect: 'read' | 'write') =>
      fence({
        effect: () => effect,
        describe: () => `game ${method}`,
        run: (args: GameArgs<Method>) => callBridge(bridge, method, args),
      });

    const snapshotSecond = call('snapshotSecond', 'read');

    return {
      readState: call('readState', 'read'),
      navigate: call('navigate', 'write'),
      setNetwork: call('setNetwork', 'write'),
      signInSecond: call('signInSecond', 'write'),
      clickSecond: call('clickSecond', 'write'),
      snapshotSecond: () => snapshotSecond(null),
    };
  },
  checks: [
    {
      name: 'attached',
      timeoutMs: 10_000,
      run: async (ctx) => {
        await callBridge(ctx.session.service('bridge'), 'status', null);
      },
    },
  ],
});

// Indexing this mapped type by a method keeps that method's result type, which indexing the
// contract's own type loses to a union of every result.
type GameResultSchemas = {
  readonly [Method in GameMethod]: { readonly result: z.ZodType<GameResult<Method>> };
};

const resultSchemas: GameResultSchemas = gameServiceContract;

async function callBridge<Method extends GameMethod>(
  bridge: ServiceCaller,
  method: Method,
  args: GameArgs<Method>,
): Promise<GameResult<Method>> {
  const answer = await bridge.call(method, args);

  return resultSchemas[method].result.parse(answer);
}
