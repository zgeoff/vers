import * as E from '@react-email/components';
import { generateEmail } from './generate-email';
import { PasswordChangedEmail } from './templates/password-changed-email';

interface Config {
  email: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function generatePasswordChangedEmail(config: Config) {
  return generateEmail({
    component: (
      <E.Html dir="ltr" lang="en">
        <PasswordChangedEmail email={config.email} />
      </E.Html>
    ),
  });
}
