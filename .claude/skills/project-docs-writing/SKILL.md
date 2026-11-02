---
name: project-docs-writing
description:
  "vers's own docs rules beside the shared docs-writing skill: game-design notes, no decision
  records, the game glossary, and two banned words that the prose check misses. Load it beside
  docs-writing before you write, edit or review committed prose in vers, a PR description or an
  issue."
metadata:
  kind: rule-set
---

# vers docs writing

## Departures

- Keep each game-design note in [`docs/game-design/`](../../../docs/game-design/) after the code it
  describes lands. In [The docs/ tree](../docs-writing/references/docs-tree.md), docs-writing has
  you delete a design once its code is built. vers keeps the note, because it records what the
  player experiences, and an architecture doc never covers that.
- Write no decision record in `docs/decisions/`, the folder that
  [The docs/ tree](../docs-writing/references/docs-tree.md) gives decision records. Put the reason
  for a decision in the description of the PR that makes it, beside the change it explains. vers
  squash-merges with a blank commit body, so a reason in a branch commit's body is lost.

## Game-design notes

- Write what the player experiences in a game-design note, and how the code delivers it in an
  architecture doc. Never describe the player's experience in an architecture doc.
- Write a game-design decision in the game-design note it changes, before the code exists, and keep
  it there after.
- When a game-design decision shaped code that exists, link its note once, in one sentence, from the
  architecture doc that covers that code.
- Leave the reason for a decision out of every architecture doc, and the alternatives it rejected
  out of every doc. Both go in the PR description.

## The game glossary

- In every doc under `docs/game-design/` and `docs/architecture/game/`, and in their diagrams, use
  the term that [`glossary.md`](../../../docs/architecture/game/glossary.md) defines.
- When a game term appears in two or more docs, define it in the glossary, once.

## Banned words

`chex prose` fails a committed file that uses one of the banned words it searches for. Keep those
words out of a PR description and an issue too: save the text as an untracked file at the repo root,
such as `pr-body.md`, run `bun x @zgeoff/chex prose pr-body.md`, then delete the file. The check
skips a file outside the repo or one git ignores.

The check neither fails nor lists these two, because only a reader can tell the figurative use:

- Write "applies", "takes effect", or the consequence, in place of a figurative "bites".
- Write "minimum", "lower bound" or "at least" in place of a figurative "floor". Keep "floor" for a
  literal floor, and for a game mechanic that a game-design note names "floor".
