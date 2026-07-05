import type { AuthUtilities } from '@urql/exchange-auth';
import { UnreachableCodeError } from '@vers/utils';
import invariant from 'tiny-invariant';
import { graphql } from '../gql';
import { getLoginPathWithRedirect } from './get-login-path-with-redirect.server';
import { isMutationError } from './is-mutation-error';
import { logout } from './logout.server';

const RefreshAccessTokenMutation = graphql(/* GraphQL */ `
  mutation RefreshAccessToken($input: RefreshAccessTokenInput!) {
    refreshAccessToken(input: $input) {
      ... on TokenPayload {
        accessToken
        refreshToken
      }

      ... on MutationErrorPayload {
        error {
          title
          message
        }
      }
    }
  }
`);

interface Context {
  refreshToken: string;
  utils: AuthUtilities;
}

interface TokenPayload {
  accessToken: string;
  refreshToken: string;
}

export async function refreshAccessToken(request: Request, ctx: Context): Promise<TokenPayload> {
  const result = await ctx.utils.mutate(RefreshAccessTokenMutation, {
    input: {
      refreshToken: ctx.refreshToken,
    },
  });

  const isError = Boolean(result.error) || isMutationError(result.data?.refreshAccessToken);

  if (isError) {
    await logout(request, { redirectTo: getLoginPathWithRedirect(request) });

    throw new UnreachableCodeError('logout throws a redirect');
  }

  invariant(result.data && !isMutationError(result.data.refreshAccessToken));

  return result.data.refreshAccessToken;
}
