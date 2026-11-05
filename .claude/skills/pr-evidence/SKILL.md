---
name: pr-evidence
description:
  "Captures a screenshot of a web page and puts it, or a screen recording, into a pull request as
  evidence, through the user's file host. Load it before adding an image or recording to a PR, an
  issue or a review reply, and before committing an image that only shows a change."
---

# PR evidence

Upload a screenshot or a recording to the user's file host, a web service that stores the file and
gives back a URL. Put that URL in the PR as a Markdown line, and hand back the line. Never commit an
image just to show a change: it stays in the repo's history forever. Anyone with the link can open
the file, so keep every token, secret and piece of personal data out of it.

## Key rules

- [Pick the upload path](#pick-the-upload-path): the `cloud` CLI, or `curl` to the address in
  `PR_EVIDENCE_URL`; otherwise stop before you capture.
- [Save and capture](#save-and-capture): each file in `.scratch/`, kept out of git, named for what
  it shows.
- [Upload it](#upload-it): with a label and a 30-day expiry, and check the file host's response.
- [Put it in the PR](#put-it-in-the-pr): the label as the alt text, under the item it proves.

## Pick the upload path

Pick the path before you capture anything. Take the first row that matches:

| Check                                | Path                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| `command -v cloud` prints a path     | the `cloud` CLI, the file host's client on the user's own machines |
| `test -n "$PR_EVIDENCE_URL"` is true | `curl`                                                             |
| neither                              | none: stop and tell the user                                       |

The `curl` path reads two environment variables, which the user sets on the machine:

- `PR_EVIDENCE_URL`: the file host's upload address, such as `https://files.example.com/api/files`.
- `PR_EVIDENCE_TOKEN_REF`: the 1Password secret reference to the upload token, such as
  `op://<vault>/<item>/<field>`.

The path also needs the 1Password `op` CLI, signed in. Run
`op read "$PR_EVIDENCE_TOKEN_REF" > /dev/null`. When it fails, stop and tell the user. Never set
either variable yourself, and never write either value in a file you commit.

## Save and capture

1. Save each file in `.scratch/` at the root of the checkout. When git doesn't ignore that folder
   yet, add it to the clone's own exclude file, which changes no tracked file:

   ```bash
   git check-ignore -q .scratch/ || echo .scratch/ >> "$(git rev-parse --git-path info/exclude)"
   mkdir -p .scratch
   ```

2. Name the file for what it shows, in lowercase letters, digits and hyphens, such as
   `login-form-email-error.png`. The name is part of the URL.
3. Capture a web page with headless Chromium:

   ```bash
   chromium --headless --hide-scrollbars --window-size=1280,800 --screenshot=.scratch/login-form-email-error.png http://localhost:3000/login
   ```

   For an SVG or a diagram, pass its `file://` URL in place of the page's URL. The PR shows PNG,
   JPEG, GIF, WebP and AVIF as an image. Save a recording as MP4 or WebM, which the PR shows as a
   link. Any other format downloads as a file.

   When `command -v chromium` prints nothing, use another screenshot tool that runs without a person
   at the screen, or stop and tell the user. For a recording, use any recorder on the machine.

4. Open the image before you upload it. Check that it shows the change, and holds no token, secret
   or personal data. When you can't view a recording, ask the user to check it before you upload it.

## Upload it

Write a label first: a few words on what the file shows, such as `Login form with the email error`.
Leave out square brackets, which break the Markdown line. The file host stores the label, and you
use it as the alt text on both paths.

Set `expires` to `30d` on both paths. On the `curl` path, the file host refuses an expiry longer
than 30 days. Without `expires`, the file host deletes the file after 7 days, which breaks the image
in a PR that stays open longer than a week. Never set `never`: the image only needs to last through
the review.

- With the `cloud` CLI:

  ```bash
  cloud up .scratch/login-form-email-error.png --label 'Login form with the email error' --expires 30d --md
  ```

  Expect the Markdown line, with the label as the alt text. On a failure it prints an error, prints
  no line, and exits non-zero: stop and tell the user. `--expires 30d` sets the expiry, so this path
  needs no expiry check.

- With `curl`, pass the label with `--form-string`. `-F` cuts a label at a `;`.

  ```bash
  curl -sS -w '\nHTTP %{http_code}\n' --oauth2-bearer "$(op read "$PR_EVIDENCE_TOKEN_REF")" -F file=@.scratch/login-form-email-error.png --form-string 'label=Login form with the email error' -F expires=30d "$PR_EVIDENCE_URL"
  ```

  Expect a JSON body, then `HTTP 201`. Check that the body's `expiresAt` falls on the date 30 days
  from today, in UTC. Then write the line from the body's `label` and `url`: `![<label>](<url>)`.

  Any other status means the upload failed, and the body's `message` holds the reason. When the
  upload fails or `expiresAt` is wrong, stop and tell the user.

## Put it in the PR

For a recording, drop the leading `!` from the line, so the line shows as a link. For a review
reply, put the line in the reply. For PR number `<n>`:

1. Read the body: `gh pr view <n> --json body -q .body > .scratch/pr-body.md`.
2. Put the line under the bullet or checklist entry that the file is evidence for. When no entry
   matches, put it at the end.
3. Write the body back: `gh pr edit <n> --body-file .scratch/pr-body.md`.

For an issue, use `gh issue view` and `gh issue edit` the same way.

**Reply:** the Markdown line you added.
