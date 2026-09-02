import type {
  AnyContractRouter,
  ContractProcedure,
  ErrorMap,
  InferSchemaInput,
  InferSchemaOutput,
} from '@orpc/contract';
import type { AnyRouter, ORPCErrorConstructorMap } from '@orpc/server';
import { implement } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import type { HttpHandler } from 'msw';
import { http } from 'msw';
import { RPC_PREFIX } from './rpc-prefix';
import { toRPCHTTPPath } from './to-rpc-http-path';

export interface MockProcedureHandlerArgs<
  TInput,
  TContext extends Record<string, unknown>,
  TErrorMap extends ErrorMap,
> {
  readonly context: TContext;
  readonly errors: ORPCErrorConstructorMap<TErrorMap>;
  readonly input: TInput;
  readonly path: ReadonlyArray<string>;
  readonly request: Request;
}

export type MockProcedureHandler<
  TInput,
  TOutput,
  TContext extends Record<string, unknown>,
  TErrorMap extends ErrorMap,
> =
  | TOutput
  | ((
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- generic callback-arg object; members are caller-typed, no deep-readonly satisfies the rule
      args: MockProcedureHandlerArgs<TInput, TContext, TErrorMap>,
    ) => Promise<Response | TOutput> | Response | TOutput);

export interface MockProcedureProxy<
  TInput,
  TOutput,
  TContext extends Record<string, unknown>,
  TErrorMap extends ErrorMap,
> {
  handler: (mock: MockProcedureHandler<TInput, TOutput, TContext, TErrorMap>) => HttpHandler;
}

type MockServiceProxyNode<TNode, TContext extends Record<string, unknown>> =
  TNode extends ContractProcedure<
    infer TInputSchema,
    infer TOutputSchema,
    infer TErrorMap,
    infer _TMeta
  >
    ? MockProcedureProxy<
        InferSchemaOutput<TInputSchema>,
        InferSchemaInput<TOutputSchema>,
        TContext,
        TErrorMap
      >
    : TNode extends AnyContractRouter
      ? { [K in keyof TNode]: MockServiceProxyNode<TNode[K], TContext> }
      : never;

export type MockServiceProxy<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
> = MockServiceProxyNode<TContract, TContext>;

export interface MockServiceOptions<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
> {
  baseUrl: string;

  contract: TContract;

  resolveContext: (request: Request) => TContext | Promise<TContext>;
}

export function buildContractMock<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
>(
  options: Readonly<MockServiceOptions<TContract, TContext>>,
): MockServiceProxy<TContract, TContext> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- type-erased runtime Proxy walking a generic contract; no typed path-accessor exists
  return buildProxyNode(options, []) as MockServiceProxy<TContract, TContext>;
}

interface LooseMockFnArgs {
  readonly context: Record<string, unknown>;
  readonly errors: unknown;
  readonly input: unknown;
  readonly path: ReadonlyArray<string>;
  readonly request: Request;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- generic callback-arg object; members are caller-typed, no deep-readonly satisfies the rule
type LooseMockFn = (args: LooseMockFnArgs) => unknown;

interface UntypedMockServiceOptions {
  baseUrl: string;
  contract: AnyContractRouter;
  resolveContext: (request: Request) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

function buildProxyNode<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
>(
  options: Readonly<MockServiceOptions<TContract, TContext>>,
  path: ReadonlyArray<string>,
): unknown {
  const untypedOptions: UntypedMockServiceOptions = options;
  const target = { handler: (mock: unknown) => buildProcedureHandler(untypedOptions, path, mock) };

  return new Proxy(target, {
    get(currentTarget, prop, receiver): unknown {
      if (typeof prop !== 'string' || prop === 'handler') {
        return Reflect.get(currentTarget, prop, receiver) as unknown;
      }

      return buildProxyNode(options, [...path, prop]);
    },
  });
}

function buildProcedureHandler(
  options: Readonly<UntypedMockServiceOptions>,
  path: ReadonlyArray<string>,
  mock: unknown,
): HttpHandler {
  const url = `${options.baseUrl}${RPC_PREFIX}${toRPCHTTPPath(path)}`;

  return http.all(url, async (info) => {
    const context = await options.resolveContext(info.request);

    let rawResponse: Response | undefined;

    const leaf = buildMockProcedure(options.contract, path, info.request, mock, (output) => {
      rawResponse = output;
    });

    const router = buildNestedRouter(path, leaf);

    const rpcHandler = new RPCHandler(router);

    const handled = await rpcHandler.handle(info.request, {
      context,
      prefix: RPC_PREFIX,
    });

    if (rawResponse) {
      return rawResponse;
    }

    return handled.matched ? handled.response : new Response(null, { status: 404 });
  });
}

interface ProcedureImplementerHandlerArgs {
  readonly context: Record<string, unknown>;
  readonly errors: unknown;
  readonly input: unknown;
  readonly path: ReadonlyArray<string>;
}

interface ProcedureImplementer {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- generic callback-arg object; members are caller-typed, no deep-readonly satisfies the rule
  handler: (fn: (opts: ProcedureImplementerHandlerArgs) => Promise<unknown>) => AnyRouter;
}

function buildMockProcedure(
  contract: AnyContractRouter,
  path: ReadonlyArray<string>,
  request: Request,
  mock: unknown,
  onRawResponse: (response: Response) => void,
): AnyRouter {
  let node: unknown = implement(contract);

  for (const segment of path) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- type-erased runtime Proxy walking a generic contract; no typed path-accessor exists
    node = (node as Record<string, unknown>)[segment];
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- type-erased runtime Proxy walking a generic contract; no typed path-accessor exists
  const implementer = node as ProcedureImplementer;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- type-erased runtime Proxy walking a generic contract; no typed path-accessor exists
  const mockFn = typeof mock === 'function' ? (mock as LooseMockFn) : undefined;

  return implementer.handler(async (handlerOptions) => {
    const output = mockFn ? await mockFn({ ...handlerOptions, request }) : mock;

    if (output instanceof Response) {
      onRawResponse(output);
      throw new Error('buildContractMock: handler returned a raw Response');
    }

    return output;
  });
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- oRPC AnyRouter is a live router handle; no readonly form
function buildNestedRouter(path: ReadonlyArray<string>, leaf: AnyRouter): AnyRouter {
  return path.reduceRight<AnyRouter>((accumulator, segment) => ({ [segment]: accumulator }), leaf);
}
