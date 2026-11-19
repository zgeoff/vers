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
- [Put it in the PR](#put-it-in-the-pr): the label as the alt text, under the entry it proves.

## Pick the upload path

Pick the path before you capture anything. Take the first row that matches:

| Check                                                                                               | Path                                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `command -v cloud` prints a path                                                                    | the `cloud` CLI, the file host's own client |
| `test -n "$PR_EVIDENCE_URL" && test -n "${PR_EVIDENCE_TOKEN_PATH:-$PR_EVIDENCE_TOKEN_REF}"` is true | `curl`                                      |
| neither                                                                                             | none: stop and tell the user                |

The user sets these variables on the machine:

- `PR_EVIDENCE_URL`: the file host's upload address, such as `https://files.example.com/api/files`.
- `PR_EVIDENCE_TOKEN_PATH`: where 1Password keeps the upload token, as `<vault>/<item>/<field>`.
- `PR_EVIDENCE_TOKEN_REF`: the same place as an `op://<vault>/<item>/<field>` reference. A machine
  sets this one or the token path, and the token path wins when both are set.

`op run` resolves every `op://` value in its environment, and fails on one its token can't read. So
the token path has no `op://` prefix. Build the reference only inside an `op read` call, as the
commands below do, and never export it.

The `curl` path also needs the 1Password `op` CLI, signed in. Run this check:

```bash
op read "op://${PR_EVIDENCE_TOKEN_PATH:-${PR_EVIDENCE_TOKEN_REF#op://}}" > /dev/null
```

When it fails, stop and give the user `op`'s error. Never set any of these variables yourself, and
never write a value of one in a file you commit.

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

   Expect the PNG at the `--screenshot` path. For an SVG or a diagram, pass its `file://` URL in
   place of the page's URL. Save a recording as MP4 or WebM. GitHub shows PNG, JPEG, GIF, WebP and
   AVIF in the PR as an image, MP4 and WebM as a link, and offers any other format as a download.

   When `command -v chromium` prints nothing, use another screenshot tool that runs without a person
   at the screen, or stop and tell the user. For a recording, use any recorder on the machine, or
   stop and tell the user when the machine has none.

4. View the image before you upload it, with a tool that shows you images, such as your file-read
   tool. Check that it shows the change, and holds no token, secret or personal data. When you can't
   view a recording, ask the user to check it before you upload it.

## Upload it

Write a label first: a few words on what the file shows, such as `Login form with the email error`.
Leave out square brackets, which break the Markdown line. The file host stores the label, and you
use it as the alt text on both paths.

Set `expires` to `30d` on both paths. Without `expires`, the file host deletes the file after 7
days, which breaks the image in a PR that stays open longer than a week. Never set `expires` to
`never`: the image only needs to last through the review.

- With the `cloud` CLI:

  ```bash
  cloud up .scratch/login-form-email-error.png --label 'Login form with the email error' --expires 30d --md
  ```

  Expect the Markdown line, with the label as the alt text. On a failure it prints an error, prints
  no line, and exits non-zero: stop and tell the user. `--expires 30d` sets the expiry, so this path
  needs no expiry check.

- With `curl`, pass the label with `--form-string`. `-F` cuts a label at a `;`.

  ```bash
  curl -sS -w '\nHTTP %{http_code}\n' --oauth2-bearer "$(op read "op://${PR_EVIDENCE_TOKEN_PATH:-${PR_EVIDENCE_TOKEN_REF#op://}}")" -F file=@.scratch/login-form-email-error.png --form-string 'label=Login form with the email error' -F expires=30d "$PR_EVIDENCE_URL"
  ```

  Expect a JSON body, then `HTTP 201`. Check that the body's `expiresAt`, an ISO 8601 timestamp,
  falls on the date 30 days from today, in UTC. Then write the line from the body's `label` and
  `url`: `![<label>](<url>)`.

  Any other status means the upload failed, and the body's `message` holds the reason. When the
  upload fails or `expiresAt` is wrong, stop and tell the user.

## Put it in the PR

For a recording, drop the leading `!` from the line, so the line shows as a link. Then, for PR
number `<n>`:

1. Read the body: `gh pr view <n> --json body -q .body > .scratch/pr-body.md`.
2. Put the line under the entry that the file is evidence for, such as a bullet or a checklist line.
   Indent it to the entry's content column, the first column after the list marker: 2 spaces under a
   `- ` bullet, checklist lines included, and 3 under `1. `. A deeper indent turns the line into a
   code block. When no entry matches, put it at the end.
3. Write the body back: `gh pr edit <n> --body-file .scratch/pr-body.md`. Expect the PR's URL.

For an issue, use `gh issue view` and `gh issue edit` the same way. For a reply to a review comment,
post the line with
`gh api repos/<owner>/<repo>/pulls/<n>/comments/<comment id>/replies -f body='<line>'`.

**Reply:** the Markdown line you added.
