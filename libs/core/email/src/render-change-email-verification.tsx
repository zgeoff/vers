import * as E from '@react-email/components';
import { renderEmail } from './render-email';
import { ChangeEmailVerificationEmail } from './templates/change-email-verification';

interface Config {
  newEmail: string;
  verificationCode: string;
  verificationURL: string;
}

export function renderChangeEmailVerificationEmail(config: Readonly<Config>) {
  return renderEmail({
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
