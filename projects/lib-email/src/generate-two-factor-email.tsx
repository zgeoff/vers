import * as E from '@react-email/components';
import { generateEmail } from './generate-email';
import { TwoFactorEmail } from './templates/two-factor-email';

interface Config {
  verificationCode: string;
}

export function generateTwoFactorEmail(config: Readonly<Config>) {
  return generateEmail({
    component: (
      <E.Html dir="ltr" lang="en">
        <TwoFactorEmail verificationCode={config.verificationCode} />
      </E.Html>
    ),
  });
}
