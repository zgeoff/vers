import assert from 'node:assert/strict';
import { ORPCError } from '@orpc/client';
import type {
  AnyContractProcedure,
  AnyContractRouter,
  AnySchema,
  ContractRouterClient,
} from '@orpc/contract';
import { OpenAPIGenerator } from '@orpc/openapi';
import { traverseContractProcedures } from '@orpc/server';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { buildRPCTestClient } from './build-rpc-test-client';

/** An Elysia app (or anything shaped like one) a conformance case can exercise. */
export interface ConformanceCaseApp {
  readonly handle: (request: Request) => Promise<Response> | Response;
}

/** One mechanical guarantee, checked against a real app via its `handle` function. */
export interface ConformanceCase {
  /** Behavioural title, e.g. "it rejects malformed input on users.getCurrentUser". */
  run: (app: ConformanceCaseApp) => Promise<void>;
  title: string;
}

/** Header collection accepted wherever a conformance case needs to send headers. */
type ConformanceHeaders = Readonly<Record<string, string>>;

interface CollectConformanceCasesOptions {
  /** Headers carrying a valid service token with no acting user. */
  readonly anonymousHeaders: ConformanceHeaders;

  /**
   * Schema-valid sample inputs keyed by dot-path (e.g. "getCurrentUser"). Enables the
   * anonymous-call UNAUTHORIZED case for that procedure, which must reach the handler.
   */
  readonly authedSamples?: Readonly<Record<string, unknown>>;

  /** RPC mount prefix of the app under test. Default '/rpc'. */
  readonly rpcPrefix?: string;
}

/**
 * Walks a contract router and builds the mechanical conformance cases every procedure must
 * satisfy: malformed input is rejected, anonymous calls to authed procedures are rejected, and the
 * contract generates a valid OpenAPI document. Cases are skipped rather than faked when they don't
 * apply to a given procedure (e.g. no input schema, or no sample input supplied).
 */
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

/** Gathers every leaf procedure in a contract router, paired with its dot-separated path. */
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
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
  const inputSchema = procedureDef.inputSchema;

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (!inputSchema) {
    return undefined;
  }

  // oxlint-disable-next-line typescript/no-unsafe-argument -- baseline(#236)
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

/** Reads a contract procedure's declared route, schemas, and error map through oRPC's internal definition property. */
function getProcedureDef(procedure: AnyContractProcedure) {
  return procedure['~orpc'];
}

const PROBE_VALUES: ReadonlyArray<unknown> = [12_345, null, 'invalid', []];

/**
 * Finds a probe value an input schema's standard-schema validator rejects; undefined if the
 * schema accepts every probe. Assumes the schema validates synchronously, true for any schema
 * without async refinements.
 */
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

/** Builds a typed oRPC client that exercises an app's real RPC wire protocol via its `handle` function. */
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

/** Indexes a dot-path into a client object, returning the callable procedure at that path. */
function getClientProcedure(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- oRPC client proxy walked by dot-path; framework type with no readonly form
  client: ContractRouterClient<AnyContractRouter>,
  dotPath: string,
): (input: unknown) => Promise<unknown> {
  let current: unknown = client;

  for (const segment of dotPath.split('.')) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- baseline(#236)
    current = (current as Record<string, unknown>)[segment];
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- baseline(#236)
  return current as (input: unknown) => Promise<unknown>;
}

/** Runs a client call expected to throw, and returns the thrown ORPCError. */
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
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- baseline(#236)
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
