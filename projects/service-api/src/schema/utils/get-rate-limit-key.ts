import type { GraphQLResolveInfo } from 'graphql';
import type { RateLimitArgs } from 'graphql-rate-limit-directive';
import { defaultKeyGenerator } from 'graphql-rate-limit-directive';
import type { Context } from '../../types';

export function getRateLimitKey(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  directive: RateLimitArgs,
  source: unknown,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  args: Record<string, unknown>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  context: Context,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  info: GraphQLResolveInfo,
) {
  const id = context.user?.id ?? context.session?.id ?? context.ipAddress;

  return `${id}:${defaultKeyGenerator(directive, source, args, context, info)}`;
}
