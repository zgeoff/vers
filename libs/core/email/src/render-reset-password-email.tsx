import * as ReactEmail from '@react-email/components';
import { renderEmail } from './render-email';
import { ResetPasswordEmail } from './templates/reset-password-email';

interface Config {
  resetURL: string;
}

export function renderResetPasswordEmail(config: Readonly<Config>) {
  return renderEmail({
    component: (
      <ReactEmail.Html dir="ltr" lang="en">
        <ResetPasswordEmail resetURL={config.resetURL} />
      </ReactEmail.Html>
    ),
  });
}
