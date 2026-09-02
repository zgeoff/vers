import assert from 'node:assert/strict';
import { ORPCError } from '@orpc/client';
import type {
  AnyContractProcedure,
  AnyContractRouter,
  AnySchema,
  ContractProcedureDef,
  ContractRouterClient,
  ErrorMap,
  Meta,
} from '@orpc/contract';
import { OpenAPIGenerator } from '@orpc/openapi';
import { traverseContractProcedures } from '@orpc/server';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { buildRPCTestClient } from './build-rpc-test-client';

export interface ConformanceCaseApp {
  readonly handle: (request: Request) => Promise<Response> | Response;
}

export interface ConformanceCase {
  run: (app: ConformanceCaseApp) => Promise<void>;

  title: string;
}

type ConformanceHeaders = Readonly<Record<string, string>>;

interface CollectConformanceCasesOptions {
  readonly anonymousHeaders: ConformanceHeaders;

  readonly authedSamples?: Readonly<Record<string, unknown>>;

  readonly rpcPrefix?: string;
}

export function collectConformanceCases(
  contract: AnyContractRouter,
  options: CollectConformanceCasesOptions,
): Array<ConformanceCase> {
  const rpcPrefix = options.rpcPrefix ?? '/rpc';
  const cases: Array<ConformanceCase> = [];

  for (const entry of collectContractProcedures(contract)) {
    const malformedCase = buildMalformedInputCase(entry, rpcPrefix, options.anonymousHeaders);

    if (malformedCase) {
      cases.push(malformedCase);
    }

    const anonymousCase = buildAnonymousRejectionCase(entry, rpcPrefix, options);

    if (anonymousCase) {
      cases.push(anonymousCase);
    }
  }

  cases.push(buildOpenAPIGenerationCase(contract));

  return cases;
}

interface ContractProcedureEntry {
  readonly dotPath: string;
  readonly procedure: AnyContractProcedure;
}

function collectContractProcedures(contract: AnyContractRouter): Array<ContractProcedureEntry> {
  const entries: Array<ContractProcedureEntry> = [];

  traverseContractProcedures({ path: [], router: contract }, (node) => {
    entries.push({
      dotPath: node.path.join('.'),
      procedure: node.contract as AnyContractProcedure,
    });
  });

  return entries;
}

function buildMalformedInputCase(
  entry: ContractProcedureEntry,
  rpcPrefix: string,
  anonymousHeaders: ConformanceHeaders,
): ConformanceCase | undefined {
  const procedureDef = getProcedureDef(entry.procedure);
  const inputSchema = procedureDef.inputSchema;

  if (!inputSchema) {
    return undefined;
  }

  const probe = findRejectingProbe(inputSchema);

  if (probe === undefined) {
    return undefined;
  }

  return {
    run: async (app) => {
      const client = buildConformanceClient(app, rpcPrefix, anonymousHeaders);
      const call = getClientProcedure(client, entry.dotPath);

      const error = await runRejectingCall(() => call(probe));

      assert.equal(error.code, 'BAD_REQUEST');
    },
    title: `it rejects malformed input on ${entry.dotPath}`,
  };
}

function getProcedureDef(
  procedure: AnyContractProcedure,
): ContractProcedureDef<AnySchema, AnySchema, ErrorMap, Meta> {
  // oxlint-disable-next-line typescript/no-unsafe-return -- AnyContractProcedure type-erases its schema/error-map generics to `any`; this is the one place that narrows `~orpc` back to its real shape so every caller gets typed fields
  return procedure['~orpc'];
}

const PROBE_VALUES: ReadonlyArray<unknown> = [12_345, null, 'invalid', []];

function findRejectingProbe(schema: AnySchema): unknown {
  for (const probe of PROBE_VALUES) {
    const result = schema['~standard'].validate(probe);

    assert.ok(!(result instanceof Promise), 'conformance probing requires a synchronous schema');

    if (result.issues) {
      return probe;
    }
  }

  return undefined;
}

function buildConformanceClient(
  app: ConformanceCaseApp,
  rpcPrefix: string,
  headers: ConformanceHeaders,
): ContractRouterClient<AnyContractRouter> {
  return buildRPCTestClient<AnyContractRouter>(app, {
    headers,
    url: `http://conformance.test${rpcPrefix}`,
  });
}

function getClientProcedure(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- oRPC client proxy walked by dot-path; framework type with no readonly form
  client: ContractRouterClient<AnyContractRouter>,
  dotPath: string,
): (input: unknown) => Promise<unknown> {
  let current: unknown = client;

  for (const segment of dotPath.split('.')) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- walking a dot-path through an untyped client proxy; no compile-time proof the segment resolves to an object
    current = (current as Record<string, unknown>)[segment];
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the final segment of a walked dot-path is a callable procedure by construction of the dotPath, not something the type checker can prove
  return current as (input: unknown) => Promise<unknown>;
}

async function runRejectingCall(call: () => Promise<unknown>): Promise<ORPCError<string, unknown>> {
  try {
    await call();
  } catch (error) {
    assert.ok(error instanceof ORPCError, `expected an ORPCError, got ${String(error)}`);

    return error;
  }

  throw new Error('expected the call to throw, but it resolved');
}

function buildAnonymousRejectionCase(
  entry: ContractProcedureEntry,
  rpcPrefix: string,
  options: CollectConformanceCasesOptions,
): ConformanceCase | undefined {
  const declaresUnauthorized = 'UNAUTHORIZED' in getProcedureDef(entry.procedure).errorMap;
  const sample = options.authedSamples?.[entry.dotPath];

  if (!declaresUnauthorized || sample === undefined) {
    return undefined;
  }

  return {
    run: async (app) => {
      const client = buildConformanceClient(app, rpcPrefix, options.anonymousHeaders);
      const call = getClientProcedure(client, entry.dotPath);

      const error = await runRejectingCall(() => call(sample));

      assert.equal(error.code, 'UNAUTHORIZED');
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ORPCError#data is unknown; the UNAUTHORIZED shape is a runtime contract this conformance case verifies, not something declared in its type
      assert.equal((error.data as { reason: string }).reason, 'missing-session');
    },
    title: `it rejects an anonymous call to ${entry.dotPath} with UNAUTHORIZED`,
  };
}

function buildOpenAPIGenerationCase(contract: AnyContractRouter): ConformanceCase {
  return {
    run: async () => {
      const generator = new OpenAPIGenerator({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      });

      const document = await generator.generate(contract, {
        info: { title: 'conformance', version: '0.0.0' },
      });

      assert.ok(document.openapi, 'expected the generated document to declare an openapi version');

      assert.ok(
        Object.keys(document.paths ?? {}).length > 0,
        'expected the generated document to declare at least one path',
      );
    },
    title: 'it generates an OpenAPI document from the contract',
  };
}
