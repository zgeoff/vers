import * as E from '@react-email/components';
import { generateEmail } from './generate-email';
import { PasswordChangedEmail } from './templates/password-changed-email';

interface Config {
  email: string;
}

export function generatePasswordChangedEmail(config: Config) {
  return generateEmail({
    component: (
      <E.Html dir="ltr" lang="en">
        <PasswordChangedEmail email={config.email} />
      </E.Html>
    ),
  });
}
