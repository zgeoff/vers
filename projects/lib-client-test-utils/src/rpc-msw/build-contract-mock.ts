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

/** Arguments passed to a mocked procedure's handler function. */
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

/** A mocked procedure's output: a static value, or a function computing it per call. */
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

/** The leaf the proxy exposes at a contract procedure's path. */
export interface MockProcedureProxy<
  TInput,
  TOutput,
  TContext extends Record<string, unknown>,
  TErrorMap extends ErrorMap,
> {
  /** Registers a narrow MSW handler matching exactly this procedure's RPC URL. */
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

/** A typed proxy mirroring a contract's procedure tree; every leaf exposes `.handler(mock)`. */
export type MockServiceProxy<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
> = MockServiceProxyNode<TContract, TContext>;

export interface MockServiceOptions<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
> {
  /** The service's origin, e.g. `http://user.test`; the RPC mount is always `${baseUrl}/rpc`. */
  baseUrl: string;

  /** The contract the proxy mirrors; anchors every leaf's input/output/error types. */
  contract: TContract;

  /** Builds per-call context (e.g. `actingUserId`) from a request's forwarded headers. */
  resolveContext: (request: Request) => TContext | Promise<TContext>;
}

/**
 * Builds a typed proxy mirroring a contract's procedure tree. Each leaf's `.handler(mock)` wraps a
 * single implemented procedure in its own `RPCHandler` and returns a narrow MSW handler matching
 * only that procedure's RPC URL — `server.use(mock.user.getCurrentUser.handler(...))` overrides
 * just that one call over a full-contract base backend, leaving every other call to fall through to
 * it.
 */
export function buildContractMock<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
>(
  options: Readonly<MockServiceOptions<TContract, TContext>>,
): MockServiceProxy<TContract, TContext> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- type-erased runtime Proxy walking a generic contract; no typed path-accessor exists
  return buildProxyNode(options, []) as MockServiceProxy<TContract, TContext>;
}

/** Arguments a mocked procedure's handler function receives, once its types are erased. */
interface LooseMockFnArgs {
  readonly context: Record<string, unknown>;
  readonly errors: unknown;
  readonly input: unknown;
  readonly path: ReadonlyArray<string>;
  readonly request: Request;
}

/** A mocked procedure's handler function, once its input/output/error/context types are erased. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- generic callback-arg object; members are caller-typed, no deep-readonly satisfies the rule
type LooseMockFn = (args: LooseMockFnArgs) => unknown;

/** The loosely-typed view of `MockServiceOptions` this module's runtime traversal operates over. */
interface UntypedMockServiceOptions {
  baseUrl: string;
  contract: AnyContractRouter;
  resolveContext: (request: Request) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

/** Recursively builds the proxy tree, tracking the dot-path walked so far. */
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

/** Builds the narrow MSW handler for one procedure's `.handler(mock)` call. */
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

/** Arguments a single implemented procedure's inner handler receives. */
interface ProcedureImplementerHandlerArgs {
  readonly context: Record<string, unknown>;
  readonly errors: unknown;
  readonly input: unknown;
  readonly path: ReadonlyArray<string>;
}

/** The shape `implement(contract)` exposes at a single procedure's path. */
interface ProcedureImplementer {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- generic callback-arg object; members are caller-typed, no deep-readonly satisfies the rule
  handler: (fn: (opts: ProcedureImplementerHandlerArgs) => Promise<unknown>) => AnyRouter;
}

/**
 * Implements the single procedure at `path`, resolving `mock` per call. A `Response` result is
 * captured via `onRawResponse` and the procedure rejects, since a raw `Response` can't itself
 * satisfy the procedure's output schema; the caller replaces the RPC response with it verbatim.
 */
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

/** Rebuilds the nested router shape a single implemented procedure needs to sit at its path. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- oRPC AnyRouter is a live router handle; no readonly form
function buildNestedRouter(path: ReadonlyArray<string>, leaf: AnyRouter): AnyRouter {
  return path.reduceRight<AnyRouter>((accumulator, segment) => ({ [segment]: accumulator }), leaf);
}
