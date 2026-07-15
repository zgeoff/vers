import * as E from '@react-email/components';
import { renderEmail } from './render-email';
import { PasswordChangedEmail } from './templates/password-changed-email';

interface Config {
  email: string;
}

export function renderPasswordChangedEmail(config: Readonly<Config>) {
  return renderEmail({
    component: (
      <E.Html dir="ltr" lang="en">
        <PasswordChangedEmail email={config.email} />
      </E.Html>
    ),
  });
}
