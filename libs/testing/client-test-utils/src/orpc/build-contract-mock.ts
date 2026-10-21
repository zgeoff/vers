import type {
  AnyContractRouter,
  ContractProcedure,
  ErrorMap,
  InferSchemaInput,
  InferSchemaOutput,
} from '@orpc/contract';
import type { AnyRouter, ORPCErrorConstructorMap } from '@orpc/server';
import { implement, isProcedure } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import type { HttpHandler, HttpResponseResolver } from 'msw';
import { http } from 'msw';
import invariant from 'tiny-invariant';
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
  // oxlint-disable-next-line typescript/consistent-type-assertions -- approved GEO-1460: TypeScript cannot prove a runtime Proxy matches a recursive mapped type
  return buildProxyNode(options, []) as MockServiceProxy<TContract, TContext>;
}

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
        const value: unknown = Reflect.get(currentTarget, prop, receiver);

        return value;
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

  return http.all(url, makeProcedureResolver(options, path, mock));
}

function makeProcedureResolver(
  options: Readonly<UntypedMockServiceOptions>,
  path: ReadonlyArray<string>,
  mock: unknown,
): HttpResponseResolver {
  return async (info) => {
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
  };
}

function buildMockProcedure(
  contract: AnyContractRouter,
  path: ReadonlyArray<string>,
  request: Request,
  mock: unknown,
  onRawResponse: (response: Response) => void,
): AnyRouter {
  let parent: unknown;
  let node: unknown = implement(contract);

  for (const segment of [...path, 'handler']) {
    // an oRPC implementer node is a callable proxy, so a function is walkable as well as an object
    invariant(
      (typeof node === 'object' && node !== null) || typeof node === 'function',
      `buildContractMock: no contract node at ${path.join('.')}`,
    );

    parent = node;
    node = Reflect.get(node, segment);
  }

  invariant(typeof node === 'function', `buildContractMock: ${path.join('.')} is no procedure`);

  const procedure: unknown = Reflect.apply(node, parent, [
    makeMockProcedureHandler(request, mock, onRawResponse),
  ]);

  invariant(isProcedure(procedure), `buildContractMock: ${path.join('.')} built no procedure`);

  return procedure;
}

interface ProcedureImplementerHandlerArgs {
  readonly context: Record<string, unknown>;
  readonly errors: unknown;
  readonly input: unknown;
  readonly path: ReadonlyArray<string>;
}

function makeMockProcedureHandler(
  request: Request,
  mock: unknown,
  onRawResponse: (response: Response) => void,
): (handlerOptions: ProcedureImplementerHandlerArgs) => Promise<unknown> {
  return async (handlerOptions) => {
    const output: unknown =
      typeof mock === 'function'
        ? await Reflect.apply(mock, undefined, [{ ...handlerOptions, request }])
        : mock;

    if (output instanceof Response) {
      onRawResponse(output);
      throw new Error('buildContractMock: handler returned a raw Response');
    }

    return output;
  };
}

function buildNestedRouter(path: ReadonlyArray<string>, leaf: AnyRouter): AnyRouter {
  return path.reduceRight<AnyRouter>((accumulator, segment) => ({ [segment]: accumulator }), leaf);
}
