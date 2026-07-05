import * as E from '@react-email/components';
import { generateEmail } from './generate-email';
import { TwoFactorEmail } from './templates/two-factor-email';

interface Config {
  verificationCode: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function generateTwoFactorEmail(config: Config) {
  return generateEmail({
    component: (
      <E.Html dir="ltr" lang="en">
        <TwoFactorEmail verificationCode={config.verificationCode} />
      </E.Html>
    ),
  });
}
