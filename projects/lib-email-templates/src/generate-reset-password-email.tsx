import * as E from '@react-email/components';
import { generateEmail } from './generate-email';
import { ResetPasswordEmail } from './templates/reset-password-email';

interface Config {
  resetURL: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function generateResetPasswordEmail(config: Config) {
  return generateEmail({
    component: (
      <E.Html dir="ltr" lang="en">
        <ResetPasswordEmail resetURL={config.resetURL} />
      </E.Html>
    ),
  });
}
