import * as z from 'zod';

export type CanonicalCheckpoint = readonly [
  type: string,
  time: number,
  nextSeed: string,
  seed: string | null,
  xp: number,
  rewardSlots: ReadonlyArray<readonly [ordinal: number, nodeTier: number]>,
  levelUp: readonly [from: number, to: number] | null,
];

export interface ParsedCanonicalCaseOutput {
  readonly checkpointCount: number;
  readonly checkpoints: ReadonlyArray<CanonicalCheckpoint>;
  readonly elapsed: number;
  readonly halted: boolean;
  readonly id: string;
}

const NumberPairSchema = z.tuple([z.number(), z.number()]);

const CanonicalCheckpointSchema = z.tuple([
  z.string(),
  z.number(),
  z.string(),
  z.string().nullable(),
  z.number(),
  z.array(NumberPairSchema),
  NumberPairSchema.nullable(),
]);

const CanonicalCaseOutputSchema = z.object({
  checkpointCount: z.number(),
  checkpoints: z.array(CanonicalCheckpointSchema),
  elapsed: z.number(),
  halted: z.boolean(),
  id: z.string(),
});

export function parseCanonicalCaseOutput(canonical: string): ParsedCanonicalCaseOutput {
  return CanonicalCaseOutputSchema.parse(JSON.parse(canonical));
}
