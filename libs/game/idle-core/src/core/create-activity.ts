import type {
  Activity,
  ActivityInput,
  ActivityLevelUp,
  ActivityRewards,
  ActivitySnapshot,
  SimulationContext,
  Wave,
} from '../types';
import { getWaves } from './utils/get-waves';

export function createActivity(data: ActivityInput, ctx: SimulationContext): Activity {
  let elapsed = 0;
  let currentWaveIdx = 0;
  let rewards: ActivityRewards = { xp: 0 };
  let levelUp: ActivityLevelUp | null = null;
  const waves: Array<Wave> = getWaves(data, ctx);
  const isWavesRemaining = () => waves.some((wave) => wave.remaining > 0);

  const advanceWave = () => {
    currentWaveIdx++;
  };

  const advanceTime = (time: number) => {
    elapsed += time;
  };

  const updateRewards = (delta: ActivityRewards) => {
    rewards = mergeRewards(rewards, delta);
  };

  const setLevelUp = (nextLevelUp: ActivityLevelUp) => {
    levelUp = nextLevelUp;
  };

  const getSnapshot = (): ActivitySnapshot => {
    const currentWave = waves[currentWaveIdx]?.getSnapshot() ?? null;
    const enemiesRemaining = waves.reduce((acc, wave) => acc + wave.remaining, 0);
    const wavesRemaining = waves.filter((wave) => wave.remaining > 0).length;

    return {
      currentWave,
      elapsed,
      enemiesRemaining,
      id: data.id,
      levelUp,
      name: data.name,
      rewards,
      waves: waves.map((wave) => wave.getSnapshot()),
      wavesRemaining,
    };
  };

  return {
    // meta
    difficulty: data.difficulty,
    id: data.id,
    name: data.name,
    type: data.type,
    waves,

    // getters
    get currentWave() {
      return waves[currentWaveIdx] ?? null;
    },
    get elapsed() {
      return elapsed;
    },
    get isWavesRemaining() {
      return isWavesRemaining();
    },
    get levelUp() {
      return levelUp;
    },
    get rewards() {
      return rewards;
    },

    // core
    getSnapshot,

    // utils
    updateRewards,
    advanceTime,
    advanceWave,
    setLevelUp,
  };
}

function mergeRewards(base: ActivityRewards, delta: ActivityRewards): ActivityRewards {
  return { xp: base.xp + delta.xp };
}
