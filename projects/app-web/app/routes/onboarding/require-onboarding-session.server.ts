import { redirect } from 'react-router';
import { verifySessionStorage } from '~/session/verify-session-storage.server';
import { Routes } from '~/types';
import { requireAnonymous } from '~/utils/require-anonymous.server';

export async function requireOnboardingSession(
  request: Request,
): Promise<{ email: string; transactionToken: string }> {
  await requireAnonymous(request);

  const verifySession = await verifySessionStorage.getSession(request.headers.get('cookie'));

  const email = verifySession.get('onboarding#email');
  const transactionToken = verifySession.get('onboarding#transactionToken');
  const isValidEmail = typeof email === 'string' && email.length > 0;
  const isValidTransactionToken =
    typeof transactionToken === 'string' && transactionToken.length > 0;

  if (!isValidEmail || !isValidTransactionToken) {
    throw redirect(Routes.Signup);
  }

  return { email, transactionToken };
}
