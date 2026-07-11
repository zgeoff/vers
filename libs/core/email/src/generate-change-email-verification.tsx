import * as E from '@react-email/components';
import { generateEmail } from './generate-email';
import { ChangeEmailVerificationEmail } from './templates/change-email-verification';

interface Config {
  newEmail: string;
  verificationCode: string;
  verificationURL: string;
}

export function generateChangeEmailVerificationEmail(config: Readonly<Config>) {
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
