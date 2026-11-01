import { Evaluator, Lexer, Parser, data } from '@actions/expressions';
import type { FunctionDefinition } from '@actions/expressions/funcs/info';
import { truthy } from '@actions/expressions/result';
import invariant from 'tiny-invariant';
import type { WorkflowJob } from './types';

const STATUS_CALL = /\b(?:always|cancelled|failure|success)\s*\(/iu;

export function isConditionMet(job: WorkflowJob, results: Map<string, string>): boolean {
  const needResults = new Map(
    job.needs.map((need) => {
      const result = results.get(need);

      invariant(result !== undefined, `${need} has no result before ${job.condition} reads it`);

      return [need, result];
    }),
  );

  const statusFunctions = buildStatusFunctions([...needResults.values()]);

  // GitHub adds success() to an `if:` that calls no status function
  const expression = STATUS_CALL.test(job.condition)
    ? job.condition
    : `success() && (${job.condition})`;

  const lexed = new Lexer(expression).lex();
  const parsed = new Parser(lexed.tokens, ['needs'], [...statusFunctions.values()]).parse();

  const needs = new data.Dictionary(
    ...[...needResults].map(([need, result]) => ({
      key: need,
      value: new data.Dictionary({ key: 'result', value: new data.StringData(result) }),
    })),
  );

  return truthy(
    new Evaluator(
      parsed,
      new data.Dictionary({ key: 'needs', value: needs }),
      statusFunctions,
    ).evaluate(),
  );
}

function buildStatusFunctions(needResults: Array<string>): Map<string, FunctionDefinition> {
  const statuses: Record<string, boolean> = {
    always: true,

    // neither a job that its own concurrency group cancels nor a job that times out cancels the
    // run, so cancelled() stays false for the rest of it
    cancelled: false,
    failure: needResults.includes('failure'),
    success: needResults.every((result) => result === 'success'),
  };

  return new Map(
    Object.entries(statuses).map(([name, status]): [string, FunctionDefinition] => [
      name,
      { name, minArgs: 0, maxArgs: 0, call: () => new data.BooleanData(status) },
    ]),
  );
}
