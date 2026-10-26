---
name: pr-evidence
description:
  How to put a screenshot, screen recording, or other image into a pull request as evidence. The
  agent uploads it to the files.geoff.cloud file drop with `cloud up --md`, or with one curl line on
  an imp, and pastes the Markdown line into the PR body. Load it before adding a screenshot or
  recording to a PR, an issue, or a review reply, and before committing an image that only shows a
  change.
---

# PR evidence

A screenshot or a recording that shows a change goes to the file drop at `files.geoff.cloud`, and
the pull request links it. Never commit an image to a branch or a repo to hold PR evidence: the
commit keeps the image in the repo's history for good, and a branch made only to hold images stays
behind after the PR merges. An image the product ships, such as an icon or a figure in a doc, is
part of the change and is committed as usual.

The service's code and docs live in zgeoff/cloud, and its
[architecture doc](https://github.com/zgeoff/cloud/blob/main/docs/architecture/workloads/files.md)
owns how it stores, serves and expires a file.

## Add a screenshot to a PR

Anyone with the link can read the file, so crop out any token, secret, or personal data before you
upload it. The URL holds the filename, so name the file for what it shows.

1. Save the image outside the checkout, or in a git-ignored folder, so it never gets staged.
2. Upload it with the command for your machine, from [Upload commands](#upload-commands).
3. Paste the Markdown line into the PR body, under the item it is evidence for. A comment or a
   review reply takes the same line.

## Upload commands

### With the cloud CLI

Use this where the `cloud` CLI exists, which `command -v cloud` shows:

```bash
cloud up login-form.png --md
```

Expect one line of the form `![login-form.png](https://files.geoff.cloud/<id>/login-form.png)`.

### On an imp

An imp has no `cloud` CLI. Upload with curl and the agent token, which `op read` gets from the `imp`
vault through 1Password Connect:

```bash
curl -sS --oauth2-bearer "$(op read op://imp/files-agent-token/credential)" -F file=@login-form.png https://files.geoff.cloud/api/files
```

Expect a JSON body whose `url` is `https://files.geoff.cloud/<id>/login-form.png`. Write the
Markdown line yourself: `![<what the image shows>](<url>)`.

## Expiry

An upload expires 7 days after it is made unless you pass an expiry, and the link then answers 404,
so the image breaks in the PR. Pass `--expires 30d` to `cloud up`, or `-F expires=30d` to curl, for
a PR that can stay open longer than a week. The agent token keeps a file 30 days at most, and the
service refuses a longer expiry or `never` from it.

## File types

The service serves a file inline only when its first bytes show a PNG, JPEG, GIF, WebP or AVIF
image, or an MP4 or WebM video. It serves every other file, SVG and HTML included, as a download, so
such a file never renders in the PR: export an SVG or a diagram to PNG before you upload it. For a
video, drop the leading `!` from the line, so the PR shows a link that plays the video.
