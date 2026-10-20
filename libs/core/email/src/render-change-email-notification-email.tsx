import * as ReactEmail from '@react-email/components';
import { renderEmail } from './render-email';
import { ChangeEmailNotificationEmail } from './templates/change-email-notification';

export function renderChangeEmailNotificationEmail() {
  return renderEmail({
    component: (
      <ReactEmail.Html dir="ltr" lang="en">
        <ChangeEmailNotificationEmail />
      </ReactEmail.Html>
    ),
  });
}
