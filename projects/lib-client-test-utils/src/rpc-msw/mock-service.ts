import type {
  AnyContractRouter,
  ContractProcedure,
  ErrorMap,
  InferSchemaInput,
  InferSchemaOutput,
} from '@orpc/contract';
import type { ORPCErrorConstructorMap, Router } from '@orpc/server';
import { implement } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import type { HttpHandler } from 'msw';
import { http } from 'msw';
import { toRPCHTTPPath } from './to-rpc-http-path';

/** The RPC mount point every service exposes its contract under; see docs/002-service-contracts.md. */
const RPC_PREFIX = '/rpc';

/** Arguments passed to a mocked procedure's handler function. */
export interface MockProcedureHandlerArgs<
  TInput,
  TContext extends Record<string, unknown>,
  TErrorMap extends ErrorMap,
> {
  context: TContext;
  errors: ORPCErrorConstructorMap<TErrorMap>;
  input: TInput;
  path: ReadonlyArray<string>;
  request: Request;
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
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- this module's own generic args type, not worth deep-readonly wrapping
      args: MockProcedureHandlerArgs<TInput, TContext, TErrorMap>,
    ) => Promise<Response | TOutput> | Response | TOutput);

/** The leaf a `mockService` proxy exposes at a contract procedure's path. */
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Request is a DOM built-in, not declared readonly
  resolveContext: (request: Request) => TContext | Promise<TContext>;
}

/**
 * Builds a typed proxy mirroring a contract's procedure tree. Each leaf's `.handler(mock)` wraps a
 * single implemented procedure in its own `RPCHandler` and returns a narrow MSW handler matching
 * only that procedure's RPC URL — `server.use(mock.user.getCurrentUser.handler(...))` overrides
 * just that one call over a base backend registered by `buildMockService`, leaving every other
 * call to fall through to it.
 */
export function mockService<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the contract router type this mirrors isn't declared readonly
  options: MockServiceOptions<TContract, TContext>,
): MockServiceProxy<TContract, TContext> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the runtime proxy walks the contract generically; this cast is what the exported type promises callers
  return buildProxyNode(options, []) as MockServiceProxy<TContract, TContext>;
}

/** Arguments a mocked procedure's handler function receives, once its types are erased. */
interface LooseMockFnArgs {
  context: Record<string, unknown>;
  errors: unknown;
  input: unknown;
  path: ReadonlyArray<string>;
  request: Request;
}

/** A mocked procedure's handler function, once its input/output/error/context types are erased. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- this module's own generic args type, not worth deep-readonly wrapping
type LooseMockFn = (args: LooseMockFnArgs) => unknown;

/** The loosely-typed view of `MockServiceOptions` this module's runtime traversal operates over. */
interface UntypedMockServiceOptions {
  baseUrl: string;
  contract: AnyContractRouter;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Request is a DOM built-in, not declared readonly
  resolveContext: (request: Request) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

/** Recursively builds the proxy tree, tracking the dot-path walked so far. */
function buildProxyNode<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the contract router type this mirrors isn't declared readonly
  options: MockServiceOptions<TContract, TContext>,
  path: ReadonlyArray<string>,
): unknown {
  const untypedOptions: UntypedMockServiceOptions = options;

  const target = { handler: (mock: unknown) => buildProcedureHandler(untypedOptions, path, mock) };

  return new Proxy(target, {
    get(currentTarget, prop, receiver) {
      if (typeof prop !== 'string' || prop === 'handler') {
        // oxlint-disable-next-line typescript/no-unsafe-return -- ProxyHandler.get's own signature returns `any`
        return Reflect.get(currentTarget, prop, receiver);
      }

      return buildProxyNode(options, [...path, prop]);
    },
  });
}

/** Builds the narrow MSW handler for one procedure's `.handler(mock)` call. */
function buildProcedureHandler(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- carries a resolveContext callback typed over the DOM's Request
  options: UntypedMockServiceOptions,
  path: ReadonlyArray<string>,
  mock: unknown,
): HttpHandler {
  const url = `${options.baseUrl}${RPC_PREFIX}${toRPCHTTPPath(path)}`;

  return http.all(url, async (info) => {
    const context = await options.resolveContext(info.request);
    let rawResponse: Response | undefined;

    const leaf = implementMockProcedure(options.contract, path, info.request, mock, (output) => {
      rawResponse = output;
    });

    const router = nestProcedureAtPath(path, leaf);

    const rpcHandler = new RPCHandler(router);

    const { matched, response } = await rpcHandler.handle(info.request, {
      context,
      prefix: RPC_PREFIX,
    });

    if (rawResponse) {
      return rawResponse;
    }

    return matched ? response : new Response(null, { status: 404 });
  });
}

/** Arguments a single implemented procedure's inner handler receives. */
interface ProcedureImplementerHandlerArgs {
  context: Record<string, unknown>;
  errors: unknown;
  input: unknown;
  path: ReadonlyArray<string>;
}

/** The shape `implement(contract)` exposes at a single procedure's path. */
interface ProcedureImplementer {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- this module's own generic args type, not worth deep-readonly wrapping
  handler: (fn: (opts: ProcedureImplementerHandlerArgs) => Promise<unknown>) => unknown;
}

/**
 * Implements the single procedure at `path`, resolving `mock` per call. A `Response` result is
 * captured via `onRawResponse` and the procedure rejects, since a raw `Response` can't itself
 * satisfy the procedure's output schema; the caller replaces the RPC response with it verbatim.
 */
function implementMockProcedure(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- @orpc/contract's router type isn't declared readonly
  contract: AnyContractRouter,
  path: ReadonlyArray<string>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Request is a DOM built-in, not declared readonly
  request: Request,
  mock: unknown,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Response is a DOM built-in, not declared readonly
  onRawResponse: (response: Response) => void,
): unknown {
  let node: unknown = implement(contract);

  for (const segment of path) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- walking a generically-shaped implementer tree at runtime
    node = (node as Record<string, unknown>)[segment];
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the resolved node is the implementer for `path`'s leaf procedure
  const implementer = node as ProcedureImplementer;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callers supply either a static value or this shape; only the function case is cast
  const mockFn = typeof mock === 'function' ? (mock as LooseMockFn) : undefined;

  return implementer.handler(async (handlerOptions) => {
    const output = mockFn ? await mockFn({ ...handlerOptions, request }) : mock;

    if (output instanceof Response) {
      onRawResponse(output);

      throw new Error('mockService: handler returned a raw Response');
    }

    return output;
  });
}

/** Rebuilds the nested router shape a single implemented procedure needs to sit at its path. */
function nestProcedureAtPath(
  path: ReadonlyArray<string>,
  leaf: unknown,
): Router<AnyContractRouter, Record<string, unknown>> {
  const nested = path.reduceRight<unknown>(
    (accumulator, segment) => ({ [segment]: accumulator }),
    leaf,
  );

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the single-procedure router is assembled generically at runtime
  return nested as Router<AnyContractRouter, Record<string, unknown>>;
}
