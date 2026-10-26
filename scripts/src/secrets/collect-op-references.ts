import invariant from 'tiny-invariant';
import type { OPReference } from './types';

// a segment stops at a quote, whitespace or a shell or template delimiter, so a reference that
// interpolates its item (`op://vers/${item}/dsn`) never matches as a literal one
const OP_REFERENCE_PATTERN =
  /op:\/\/(?<vault>[\w.-]+)\/(?<item>[\w.-]+)\/(?<field>[\w.-]+)(?=[\s'"`)]|$)/gmu;

export function collectOPReferences(text: string): Array<OPReference> {
  return Array.from(text.matchAll(OP_REFERENCE_PATTERN), (found) => {
    const segments = found.groups;

    invariant(
      segments?.['vault'] !== undefined &&
        segments['item'] !== undefined &&
        segments['field'] !== undefined,
      'the pattern captures three named segments',
    );

    return { field: segments['field'], item: segments['item'], vault: segments['vault'] };
  });
}
