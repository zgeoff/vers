const QA_EMAIL_DOMAIN = 'qa.versidle.com';

export function isQAAccountEmail(email: string): boolean {
  const separator = email.lastIndexOf('@');

  if (separator === -1) {
    return false;
  }

  const domain = email
    .slice(separator + 1)
    .trim()
    .toLowerCase();

  return domain === QA_EMAIL_DOMAIN || domain.endsWith(`.${QA_EMAIL_DOMAIN}`);
}
