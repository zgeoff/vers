# signup

A player signs up on `/signup` with an email address, types the 6-character code from the welcome
email, fills in the onboarding form, and creates a first avatar. The game then opens on `/explore`.
The `local` target sends each email to a stub, and `bun verify action read-email` prints the code of
the last one in `data.code`.

`bun verify up` starts an empty database. Run this journey first after each `up` or `up --restart`:
the other journeys play as the account it makes.

Before you start:

- Pick an account name of 3 to 6 lowercase letters, such as `heron`. Put it in place of `RUN` in
  this journey and in every other one. An avatar name takes letters only, so a digit breaks
  `Create Avatar`.
- Keep the `wv-` prefix and the `qa.versidle.com` domain. The game's state hook answers only for
  that domain, and `remove-account` removes only `wv-` accounts.
- Tick the terms checkbox by clicking its label by `--ref`. The checkbox input is hidden, so a click
  on `--role checkbox` times out.
- When a page shows "Something went wrong", you sent its form within 1.5 s of the page loading.
  Click the submit button again.

## Journey

```bash
bun verify use --feature signup
bun verify browser goto /signup
bun verify browser type --role textbox --name Email --value wv-RUN@qa.versidle.com
bun verify browser click --role button --name Signup
# waits up to 20 s for the email
bun verify action read-email --to wv-RUN@qa.versidle.com
# typing the code into the first box fills all six
bun verify browser type --role textbox --name "pin code 1 of 6" --value "<data.code from read-email>"
bun verify browser click --role button --name Verify
# expect data.url on /onboarding
bun verify browser type --role textbox --name Username --value wv_RUN
bun verify browser type --role textbox --name Name --value "Verify Player"
bun verify browser type --role textbox --name Password --value Verify-pass-123
bun verify browser type --role textbox --name "Confirm Password" --value Verify-pass-123
bun verify browser snapshot
bun verify browser click --ref "<ref of the Agree to terms label in the snapshot>"
bun verify browser click --role button --name "Create an Account"
# expect data.url on /avatars/create
bun verify browser type --role textbox --name Name --value WvRUN
bun verify browser click --role button --name "Create Avatar"
# expect data.url on /explore
bun verify browser snapshot
bun verify db query "select u.username, a.name from users u join avatars a on a.user_id = u.id where u.email = 'wv-RUN@qa.versidle.com'"
```

When a `click` prints a `data.url` other than the one its comment expects, read the page with
`snapshot`, and fix what it shows before you go on.

## End state

- The last `snapshot` has a `Switch avatar (WvRUN)` link in the game's navigation.
- The `db query` prints one row: `wv_RUN` and `WvRUN`.
