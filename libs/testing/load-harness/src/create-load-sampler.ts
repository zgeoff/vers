import type { DB } from '@vers/db';
import { $ } from 'bun';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import * as z from 'zod';
import { makeReadVerifiedAges } from './make-read-verified-ages';
import { parseContainerStats } from './parse-container-stats';
import type { ContainerSample, PipelineSample, SamplerRecording } from './types';

interface CreateLoadSamplerOptions {
  readonly containerPrefix: string;
  readonly db: Kysely<DB>;
  readonly intervalMs: number;
}

interface LoadSampler {
  readonly stop: () => Promise<SamplerRecording>;
}

// samples the shared database and the containers from outside the stack, so no instrument the
// services lack is needed
export function createLoadSampler(options: Readonly<CreateLoadSamplerOptions>): LoadSampler {
  const startedAt = performance.now();
  const recording: SamplerRecording = { containers: [], pipeline: [], settlementAges: [] };
  const readVerifiedAges = makeReadVerifiedAges(options.db);

  const controller = new AbortController();

  const pipelineLoop = runEvery(options.intervalMs, controller.signal, async () => {
    const elapsedMs = performance.now() - startedAt;

    const sample = await readPipelineSample(options.db, elapsedMs);
    const ages = await readVerifiedAges();

    recording.pipeline.push(sample);

    for (const ageMs of ages) {
      recording.settlementAges.push({ ageMs, elapsedMs });
    }
  });

  const containerLoop = runEvery(options.intervalMs, controller.signal, async () => {
    const elapsedMs = performance.now() - startedAt;

    const output = await $`docker stats --no-stream --format ${'{{json .}}'}`.quiet().text();

    const samples = collectContainerSamples(output, options.containerPrefix, elapsedMs);

    recording.containers.push(...samples);
  });

  return {
    stop: async () => {
      controller.abort();

      await Promise.all([pipelineLoop, containerLoop]);

      return recording;
    },
  };
}

async function runEvery(
  intervalMs: number,
  signal: AbortSignal,
  tick: () => Promise<void>,
): Promise<void> {
  while (!signal.aborted) {
    const tickStartedAt = performance.now();

    await tick();

    await Bun.sleep(Math.max(0, intervalMs - (performance.now() - tickStartedAt)));
  }
}

const ActivityTotalsSchema = z.object({
  appended: z.coerce.number(),
  backedOff: z.coerce.number(),
  held: z.coerce.number(),
  verified: z.coerce.number(),
});

const ConnectionTotalsSchema = z.object({
  lockWaiters: z.coerce.number(),
  longestTransactionMs: z.coerce.number(),
});

async function readPipelineSample(db: Kysely<DB>, elapsedMs: number): Promise<PipelineSample> {
  const activities = await sql`
    select
      coalesce(sum(appended_head), 0) as appended,
      coalesce(sum(verified_head), 0) as verified,
      count(*) filter (where replay_backoff_until > now()) as "backedOff",
      count(*) filter (where status in ('parked', 'quarantined', 'rejected')) as held
    from activities
  `.execute(db);

  const connections = await sql`
    select
      count(*) filter (where wait_event_type = 'Lock') as "lockWaiters",
      coalesce(max(extract(epoch from now() - xact_start) * 1000) filter (where backend_type = 'client backend' and pid <> pg_backend_pid()), 0) as "longestTransactionMs"
    from pg_stat_activity
    where datname = current_database()
  `.execute(db);

  return {
    ...ActivityTotalsSchema.parse(activities.rows[0]),
    ...ConnectionTotalsSchema.parse(connections.rows[0]),
    elapsedMs,
  };
}

function collectContainerSamples(
  output: string,
  prefix: string,
  elapsedMs: number,
): Array<ContainerSample> {
  return output.split('\n').flatMap((line) => {
    const sample = parseContainerStats(line, elapsedMs);

    return sample !== undefined && sample.container.startsWith(prefix) ? [sample] : [];
  });
}
