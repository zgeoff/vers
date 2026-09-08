import type { KeyEvent } from './types';

const VIRTUAL_KEY_CODES: Readonly<Record<string, number>> = {
  Backspace: 8,
  Enter: 13,
  Escape: 27,
  Tab: 9,
};

export function buildKeyEvents(key: string): readonly [KeyEvent, KeyEvent] {
  const windowsVirtualKeyCode = VIRTUAL_KEY_CODES[key];

  const shared = {
    code: key,
    key,
    ...(windowsVirtualKeyCode !== undefined && { windowsVirtualKeyCode }),
  };

  return [
    { ...shared, type: 'keyDown', ...(key === 'Enter' && { text: '\r' }) },
    { ...shared, type: 'keyUp' },
  ];
}
