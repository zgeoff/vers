import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { z } from 'zod';
import { featurePaths, sharedPaths } from './feature-paths';

async function setupTest() {
  const gateSchema = z.object({ match: z.string(), skills: z.array(z.string()) });
  const rulesPath = join(import.meta.dir, '..', '..', '..', '..', '.claude', 'skill-gate.json');

  const rulesJSON: unknown = await Bun.file(rulesPath).json();

  const rules = z.object({ gates: z.array(gateSchema) }).parse(rulesJSON);

  return { rules };
}

test('it asks for the verify skill before an edit under each feature path and shared path', async () => {
  const ctx = await setupTest();

  const verifyGlobs = ctx.rules.gates
    .filter((gate) => gate.skills.includes('verify'))
    .map((gate) => new Bun.Glob(gate.match));

  const mapped = [...Object.values(featurePaths).flat(), ...sharedPaths];

  expect(mapped.filter((glob) => !verifyGlobs.some((gate) => gate.match(glob)))).toStrictEqual([]);
});
