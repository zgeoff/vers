const journeyAccount = /^wv-[a-z0-9-]+@qa\.versidle\.com$/u;

// A journey removes only the account it signed up, so the action refuses every other address,
// such as a seeded QA account that a person keeps for manual QA.
export function pickAccountRefusal(email: string): string | null {
  return journeyAccount.test(email.toLowerCase())
    ? null
    : `${email} is not a journey account: remove-account takes only wv-<run>@qa.versidle.com`;
}
