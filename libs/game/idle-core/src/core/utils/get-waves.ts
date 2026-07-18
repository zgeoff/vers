import type { ActivityInput, SimulationContext, Wave } from '../../types';
import { createWave } from './create-wave';

export function getWaves(activity: ActivityInput, ctx: SimulationContext): Array<Wave> {
  return activity.encounter.waves.map((enemyData, index) => createWave(index, enemyData, ctx));
}
