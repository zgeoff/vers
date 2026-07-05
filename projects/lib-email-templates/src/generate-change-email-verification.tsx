import * as E from '@react-email/components';
import { generateEmail } from './generate-email';
import { ChangeEmailVerificationEmail } from './templates/change-email-verification';

interface Config {
  newEmail: string;
  verificationCode: string;
  verificationURL: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function generateChangeEmailVerificationEmail(config: Config) {
  return generateEmail({
    component: (
      <E.Html dir="ltr" lang="en">
        <ChangeEmailVerificationEmail
          newEmail={config.newEmail}
          verificationCode={config.verificationCode}
          verificationURL={config.verificationURL}
        />
      </E.Html>
    ),
  });
}
