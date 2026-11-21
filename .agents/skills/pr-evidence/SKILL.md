---
name: pr-evidence
description:
  "Captures a screenshot of a web page and puts it, or a screen recording, into a pull request as
  evidence, through the user's file host. Load it before adding an image or recording to a PR, an
  issue or a review reply, and before committing an image that only shows a change."
---

# PR evidence

Upload a screenshot or a recording to the user's file host, a web service that stores the file and
gives back a URL. Put that URL in the PR as a Markdown line, and hand back the line. For a verify
report, hand back the PR URL that its publish command prints. Never commit an image just to show a
change: it stays in the repo's history forever. Anyone with the link can open the file, so keep
every token, secret and piece of personal data out of it.

## Key rules

- [Pick the upload path](#pick-the-upload-path): the `cloud` CLI, or `curl` to the address in
  `CLOUD_FILES_URL`; otherwise stop before you capture.
- [Save and capture](#save-and-capture): each file in `.scratch/`, kept out of git, named for what
  it shows.
- [Upload it](#upload-it): with a label and a 30-day expiry, and check the file host's response.
- [Put it in the PR](#put-it-in-the-pr): the label as the alt text, under the entry it proves.
- [Publish a verify report](#publish-a-verify-report): set the raw token for that command only.

## Pick the upload path

The user sets two variables on the machine:

- `CLOUD_FILES_URL`: the file host's upload address, such as `https://files.example.com/api/files`.
- `CLOUD_FILES_TOKEN_REF`: where 1Password keeps the upload token, as a full
  `op://<vault>/<item>/<field>` reference.

Never set either variable yourself. Never write the value of either one in a file you commit.

Keep the raw token out of the machine's environment. Read it with `op read` inside the command that
needs it. Never export it. When a command reads the token only from its environment, set the token
for that command only, as [Publish a verify report](#publish-a-verify-report) does.

Run every command in this skill from the root of the checkout. Pick the path before you capture
anything. Take the first row that matches:

| Check                                                                    | Path                                        |
| ------------------------------------------------------------------------ | ------------------------------------------- |
| `command -v cloud` prints a path                                         | the `cloud` CLI, the file host's own client |
| `test -n "$CLOUD_FILES_URL" && test -n "$CLOUD_FILES_TOKEN_REF"` is true | `curl`                                      |
| neither                                                                  | none: stop and tell the user                |

The `curl` path also needs the 1Password `op` CLI, signed in. Run this check, and when it fails,
stop and give the user `op`'s error:

```bash
op read "$CLOUD_FILES_TOKEN_REF" > /dev/null
```

## Save and capture

1. Save each file in `.scratch/`. When git doesn't ignore that folder yet, add it to the clone's own
   exclude file, which changes no tracked file:

   ```bash
   git check-ignore -q .scratch/ || echo .scratch/ >> "$(git rev-parse --git-path info/exclude)"
   mkdir -p .scratch
   ```

2. Name the file for what it shows, in lowercase letters, digits and hyphens, such as
   `settings-page-layout.png`. The name is part of the URL.
3. Start the app's dev server, and use the port it prints. Capture the page with headless Chromium.
   Each of these binaries takes the same flags:
   - `chromium`;
   - `chromium-browser`;
   - `google-chrome`.

   ```bash
   chromium --headless --hide-scrollbars --window-size=1280,800 --screenshot=.scratch/settings-page-layout.png http://localhost:3000/settings
   ```

   Expect the PNG at the `--screenshot` path. This command captures what the URL shows on a fresh
   load. For a state that needs a sign-in or a click, such as a form error, script the browser with
   a tool such as Playwright, or stop and tell the user when the machine has none. For an SVG or an
   HTML file, pass its `file://` URL in place of the page's URL.

   When none of the Chromium binaries is installed, use another screenshot tool that runs without a
   person at the screen, or stop and tell the user. For a recording, use any recorder on the
   machine, or stop and tell the user when the machine has none. Save a recording as MP4 or WebM.
   GitHub shows each format in the PR as follows:
   - PNG, JPEG, GIF, WebP and AVIF as an image;
   - MP4 and WebM as a link;
   - any other format as a download.

4. View the image before you upload it, with a tool that shows you images, such as your file-read
   tool. Check that it shows the change, and holds no token, secret or personal data. When you can't
   view a recording, ask the user to check it before you upload it.

## Upload it

Write a label first: a few words on what the file shows, such as
`Settings page with the new layout`. Leave out square brackets and apostrophes. Square brackets
break the Markdown line, and apostrophes break the shell quotes in the commands below. The file host
stores the label, and you use it as the alt text on both paths.

Set `expires` to `30d` on both paths. Without `expires`, the file host deletes the file after 7
days, which breaks the image in a PR that stays open longer than a week. Never set `expires` to
`never`: the image needs to last only through the review.

- With the `cloud` CLI:

  ```bash
  cloud up .scratch/settings-page-layout.png --label 'Settings page with the new layout' --expires 30d --md
  ```

  Expect the Markdown line, with the label as the alt text. On a failure it prints an error, prints
  no line, and exits non-zero: stop and tell the user. `--expires 30d` sets the expiry, so this path
  needs no expiry check.

- With `curl`, pass the label with `--form-string`. `-F` cuts a label at a `;`.

  ```bash
  (token="$(op read "$CLOUD_FILES_TOKEN_REF")" && curl -sS -w '\nHTTP %{http_code}\n' --oauth2-bearer "$token" -F file=@.scratch/settings-page-layout.png --form-string 'label=Settings page with the new layout' -F expires=30d "$CLOUD_FILES_URL")
  ```

  The subshell keeps the token out of your shell. When `op read` fails, `curl` never runs and no
  `HTTP` line prints: stop, and give the user the `op` error.

  Expect a JSON body, then `HTTP 201`. Check that the date in the body's `expiresAt`, an ISO 8601
  timestamp, is 30 days from today in UTC, give or take one day. Then write the line from the body's
  `label` and `url`: `![<label>](<url>)`.

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

For an issue, use `gh issue view` and `gh issue edit` the same way.

For a reply to a review comment, find the comment's `id` in
`gh api --paginate repos/<owner>/<repo>/pulls/<n>/comments`, where `<owner>/<repo>` is the PR's
repo. Then post the line:

```bash
gh api repos/<owner>/<repo>/pulls/<n>/comments/<comment id>/replies -f body='<line>'
```

## Publish a verify report

Some repos have a `verify` script in `package.json` that checks the app's features and writes a
report. Its `bun verify publish` command uploads that report and writes it into the PR. For the
report, skip [Save and capture](#save-and-capture), [Upload it](#upload-it) and
[Put it in the PR](#put-it-in-the-pr).

The command needs both variables set, even on a machine with the `cloud` CLI. Run the `test -n`
check and the `op read` check from [Pick the upload path](#pick-the-upload-path) first.

Push the branch and open the PR first: without an open PR, the command fails. The command reads the
address from `CLOUD_FILES_URL` and the raw token from `CLOUD_FILES_TOKEN`. Set the token from
1Password for this command only:

```bash
(token="$(op read "$CLOUD_FILES_TOKEN_REF")" && CLOUD_FILES_TOKEN="$token" bun verify publish --pr <n>)
```

Expect `ok: true` and the PR's URL in the output. When `op read` fails, `publish` never runs: stop,
and give the user the `op` error. On any other failure, stop and tell the user.

**Reply:** the Markdown line you added, or the PR URL that `bun verify publish` printed.
