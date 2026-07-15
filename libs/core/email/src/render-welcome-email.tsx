import * as E from '@react-email/components';
import { renderEmail } from './render-email';
import { WelcomeEmail } from './templates/welcome-email';

interface Config {
  verificationCode: string;
  verificationURL: string;
}

export function renderWelcomeEmail(config: Readonly<Config>) {
  return renderEmail({
    component: (
      <E.Html dir="ltr" lang="en">
        <WelcomeEmail
          verificationCode={config.verificationCode}
          verificationURL={config.verificationURL}
        />
      </E.Html>
    ),
  });
}
