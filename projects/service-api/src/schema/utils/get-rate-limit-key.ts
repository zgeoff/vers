import type { GraphQLResolveInfo } from 'graphql';
import type { RateLimitArgs } from 'graphql-rate-limit-directive';
import { defaultKeyGenerator } from 'graphql-rate-limit-directive';
import type { Context } from '../../types';

export function getRateLimitKey(
  directive: RateLimitArgs,
  source: unknown,
  args: Record<string, unknown>,
  context: Context,
  info: GraphQLResolveInfo,
) {
  const id = context.user?.id ?? context.session?.id ?? context.ipAddress;

  return `${id}:${defaultKeyGenerator(directive, source, args, context, info)}`;
}
