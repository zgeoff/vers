import { builder } from '../builder';
import { MutationError } from './mutation-error';

interface MutationErrorPayloadData {
  error: typeof MutationError.$inferType;
}

export const MutationErrorPayload =
  builder.objectRef<MutationErrorPayloadData>('MutationErrorPayload');

MutationErrorPayload.implement({
  fields: (t) => ({
    error: t.field({
      resolve: (source) => source.error,
      type: MutationError,
    }),
  }),
});
