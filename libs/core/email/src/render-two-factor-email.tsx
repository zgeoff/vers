import * as ReactEmail from '@react-email/components';
import { renderEmail } from './render-email';
import { TwoFactorEmail } from './templates/two-factor-email';

interface Config {
  verificationCode: string;
}

export function renderTwoFactorEmail(config: Readonly<Config>) {
  return renderEmail({
    component: (
      <ReactEmail.Html dir="ltr" lang="en">
        <TwoFactorEmail verificationCode={config.verificationCode} />
      </ReactEmail.Html>
    ),
  });
}
