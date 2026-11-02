# READMEs

A repo has five kinds of README, and each is an index or a landing page. Keep each one short. Flags,
edge cases and history belong in the code, `--help` or `docs/`, and a copy in a README goes out of
date.

Contents: [the five kinds](#the-five-kinds) · [root README](#root-readme) ·
[the header](#the-header) · [published package sections](#published-package-sections) ·
[length](#length) · [what stays out](#what-stays-out) ·
[who reviews a README](#who-reviews-a-readme)

## The five kinds

1. **Root README:** `README.md` at the repo root, the repo's front page. It is always this kind,
   even when the root has a manifest.
2. **Package README:** in any other folder with its own manifest (`package.json`, `go.mod` or
   `Cargo.toml`), wherever the folder sits. A published package gets the
   [published package sections](#published-package-sections), because the registry shows its README
   on the package's page. An unpublished package gets a short README.
3. **Docs index:** `docs/README.md`, one line and a link for each doc.
4. **Design README:** `docs/design/<work>/README.md`, one line and a link for each doc and spike in
   the design. A design folder inside another design folder gets its own design README.
5. **Spike README:** the landing page of a spike, an experiment that answers one question for a
   design. `docs-tree.md`, beside this file, lists its sections. When spikes live outside
   `docs/design/`, the folder that holds them gets a README too, as an index of the spikes.

Any other README is a mistake. Put its content in `docs/`, or in a code comment beside the code it
explains. `chex readmes` fails on a README that isn't one of these kinds.

## Root README

The root README takes one of three shapes:

- **The repo publishes one package:** the [published package sections](#published-package-sections).
- **The repo publishes several packages:** the header, one paragraph on what the repo is for, then a
  `## Packages` list with one line and a link to each published package's README. Then Quick start,
  Checks, Layout and Documentation, as for a repo that publishes nothing.
- **The repo publishes nothing:** the header, then:
  - one paragraph on what the repo is for;
  - `## Quick start`: the commands that set up the repo;
  - `## Checks`: the commands CI runs, and one line on what else CI checks;
  - `## Layout`: one line for each top-level folder, or group of folders, with its role;
  - `## Documentation`: one line that links `docs/`.

## The header

Open every root README and every published package README with this header. Replace `<name>`,
`<package>`, `<guide>`, `<Guide title>` and `<One-line description.>`, and keep the HTML tags:

```text
<div align="center">
  <h1><name></h1>

  <p>
    <a href="https://www.npmjs.com/package/<package>"><img src="https://img.shields.io/npm/v/<package>" alt="npm version"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  </p>

  <p>
    <a href="./docs/README.md">Documentation</a> •
    <a href="./docs/guides/<guide>.md"><Guide title></a>
  </p>
</div>

<One-line description.>
```

- **The `<h1>`:** the repo or package name, or a logo as an `<img>` with the name as its alt text.
- **The badges:** one per line. A published package gets its registry's version badge, such as
  npm's, crates.io's or pkg.go.dev's. Every README gets a licence badge that matches `LICENSE`. A
  root README that publishes several packages or none has no version badge.
- **The links:** the docs index, then up to two guides a new user needs first, joined by `•`. Leave
  the `<p>` out when there are no docs.
- **The description:** one line below the `<div>`, in plain Markdown.

Keep every link relative to the README's own folder. In a monorepo, a package README reaches the
repo's docs and licence through the root, such as `../../docs/README.md`. npm rewrites a relative
link to point at the repo, using the `repository` field in the package's `package.json`. In a
monorepo, that field also needs `directory`, set to the package's folder.

## Published package sections

1. The header.
2. The pitch: one or two short paragraphs that expand the one-line description. Then a demo, such as
   a short recording or a screenshot, when one exists.
3. `## Install`: one command and its prerequisites. Link a guide for any other way to install. Then
   the first 2 or 3 commands a new user runs.
4. `## Features`, with one line per feature, and a link to its doc or guide when one exists. A
   package that supports a list of tools or platforms adds a section for that list, such as
   `## Supported platforms`.
5. `## Configuration`: one paragraph, and a link to the config schema, or to the configuration guide
   when there's no schema. Leave it out when the package has no configuration.
6. `## Documentation`: one line that links `docs/`, for the reader who reads to the end.

An unpublished package gets a short README with no header: one paragraph on what the package is for,
and a link to the architecture doc that covers it, when one exists.

## Length

`chex length` sets each README's target and limit from its kind, and prints both. Cut a README to
its target. The limit is where the run fails.

## What stays out

Leave these out of every README, because the code, `--help` or `docs/` own them, and a copy goes out
of date:

- flags, exit codes and config keys;
- install steps for each tool or platform the package supports;
- edge cases inside table rows;
- tables of keys or states;
- dated "checked" stamps;
- people's names.

## Who reviews a README

The user owns what each README says about the project, so the user reviews every README change in
its PR. Don't stop to ask first. Put each change in the right PR:

- **A new package:** its README ships in the PR that adds the package.
- **A new feature:** its PR adds the feature's line.
- **A sentence your change made false:** rewrite it in the same PR.
- **Any other change to an existing README:** its own PR, a README PR.
