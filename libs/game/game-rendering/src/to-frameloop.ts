import type { Presentation } from './types';

export function toFrameloop(presentation: Presentation): 'always' | 'never' {
  return presentation === 'hidden' ? 'never' : 'always';
}
