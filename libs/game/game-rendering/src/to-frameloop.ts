import type { Presentation } from './types';

/**
 * Maps scene presentation to the canvas's frameloop mode: a hidden scene suspends rendering
 * entirely (zero GPU cost off-screen), while focus and ambient scenes render every frame.
 */
export function toFrameloop(presentation: Presentation): 'always' | 'never' {
  return presentation === 'hidden' ? 'never' : 'always';
}
