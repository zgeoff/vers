import { HOLD_SAVED_LINE } from './constants';

export async function readSaveConfirmation(input: AsyncIterable<unknown>): Promise<boolean> {
  let text = '';

  for await (const chunk of input) {
    text += String(chunk);

    const newline = text.indexOf('\n');

    if (newline !== -1) {
      return text.slice(0, newline) === HOLD_SAVED_LINE;
    }
  }

  return false;
}
