---
name: pr-evidence
description:
  'Captures a screenshot of a web page and puts it, or a screen recording, into a pull request as
  evidence, through the files.geoff.cloud file host. Load it before adding an image or recording to
  a PR, an issue or a review reply, and before committing an image that only shows a change.'
---

# PR evidence

Put a screenshot or a recording in a PR as a link to the `files.geoff.cloud` file host, and hand
back the Markdown line you added. Never commit an image just to show a change: it stays in the
repo's history forever. Anyone with the link can open the file, so keep every token, secret and
piece of personal data out of it.

## Key rules

- [Pick the upload path](#pick-the-upload-path): the `cloud` CLI, or `curl` on an imp, a cloud VM
  that runs agent sessions; otherwise stop before you capture.
- [Save and capture](#save-and-capture): each file in `.scratch/`, kept out of git, named for what
  it shows.
- [Upload it](#upload-it): with a label and a 30-day expiry, and check the reply.
- [Put it in the PR](#put-it-in-the-pr): the label as the alt text, under the item it proves.

## Pick the upload path

Pick the path before you capture anything. Take the first row that matches:

| Check                                | Path                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| `command -v cloud` prints a path     | the `cloud` CLI, the file host's client on the user's own machines |
| `test -n "$OP_CONNECT_HOST"` is true | `curl`, on an imp: a cloud VM that runs agent sessions             |
| neither                              | none: stop and tell the user                                       |

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
   JPEG, GIF, WebP and AVIF as an image, and MP4 and WebM as a link. Any other format downloads as a
   file.

   The imp's VM image installs `chromium`. When `command -v chromium` prints nothing on an imp, stop
   and tell the user. On the user's machine without it, use another screenshot tool that runs
   without a person at the screen, or stop and tell the user. For a recording, use any recorder
   there, and save MP4 or WebM.

4. Open the image before you upload it. Check that it shows the change, and holds no token, secret
   or personal data. When you can't view a recording, ask the user to check it before you upload it.

## Upload it

Write a label first: a few words on what the file shows, such as `Login form with the email error`.
Leave out square brackets, which break the Markdown line. The file host stores the label, and you
use it as the alt text on both paths.

Set `expires` to `30d` on both paths. On an imp, the file host refuses a longer expiry from the
agent token that `curl` sends. Without `expires`, the file host deletes the file after 7 days, which
breaks the image in a PR that stays open longer than a week. Never set `never`: the image only needs
to last through the review.

- With the `cloud` CLI:

  ```bash
  cloud up .scratch/login-form-email-error.png --label 'Login form with the email error' --expires 30d --md
  ```

  Expect the Markdown line, with the label as the alt text. On a failure it prints an error, prints
  no line, and exits non-zero. `--expires 30d` sets the expiry, so this path needs no expiry check.

- With `curl` on an imp:

  ```bash
  curl -sS -w '\nHTTP %{http_code}\n' --oauth2-bearer "$(op read op://imp/files-agent-token/credential)" -F file=@.scratch/login-form-email-error.png --form-string 'label=Login form with the email error' -F expires=30d https://files.geoff.cloud/api/files
  ```

  Expect a JSON body, then `HTTP 201`. The body holds `id`, `url`, `filename`, `contentType`,
  `size`, `sha256`, `createdAt`, `uploader`, `label`, `link` and `expiresAt`. Check that `expiresAt`
  falls on the date 30 days from today, then write the line from `label` and `url`:
  `![<label>](<url>)`. Use `--form-string` for the label: `-F` cuts it at a `;`.

  Any other status means the upload failed, and the body's `message` holds the reason. When the
  upload fails or `expiresAt` is wrong, stop and tell the user.

## Put it in the PR

Put the line under the bullet or checklist entry in the PR body that the file is evidence for. When
no entry matches, put it at the end. Read the body with
`gh pr view <n> --json body -q .body > .scratch/pr-body.md`, add the line, and write it back with
`gh pr edit <n> --body-file .scratch/pr-body.md`. For an issue, use `gh issue view` and
`gh issue edit` the same way. For a review reply, put the line in the reply.

For a recording, drop the leading `!`, so the line shows as a link.

**Reply:** the Markdown line you added.
