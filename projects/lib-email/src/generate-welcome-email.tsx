import * as E from '@react-email/components';
import { generateEmail } from './generate-email';
import { WelcomeEmail } from './templates/welcome-email';

interface Config {
  verificationCode: string;
  verificationURL: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function generateWelcomeEmail(config: Config) {
  return generateEmail({
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
