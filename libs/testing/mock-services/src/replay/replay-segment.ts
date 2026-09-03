import { os } from './os';

export const replaySegment = os.replaySegment.handler(() => ({ checkpoints: [], elapsed: 0 }));
