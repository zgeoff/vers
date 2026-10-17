---
name: project-docs-writing
description:
  vers's own docs rules — game-design notes, decision reasons, and the game glossary — layered on
  top of the shared docs-writing skill. Load both before writing, editing, or reviewing any
  committed prose in vers.
---

# Project docs writing

This skill extends the shared `docs-writing` skill with the rules for vers's own docs tree. Load
both. Where the two disagree, this skill wins.

## The docs/ tree

vers keeps three folders under `docs/`: `architecture/`, `runbooks/`, and one the shared tree lacks,
[`docs/game-design/`](../../../docs/game-design/), which holds the game's design language and
systems: what a player sees, feels, and decides. It has no `decisions/`, `design/`, `guides/`, or
`reference/` folder.

- **What the player sees lives in a game-design note.** An architecture doc covers how the code
  delivers it and never restates the player's experience.
- **Game design ahead of the code is a game-design note.** A game-design decision the code doesn't
  implement yet goes in `docs/game-design/`. The note stays once the code is built.
- **An architecture doc links the design once.** Where a game-design decision shaped code that
  exists, the architecture doc links the note in one sentence and stops there.
- **The commit body holds a decision's reason.** vers keeps no decision records, so the reason a
  decision was made goes in the commit message, never in an architecture doc. An architecture
  invariant carries no `**Why:**` line, and a rejected alternative appears in no doc.

## The game glossary

- **Game terms come from the glossary.**
  [`glossary.md`](../../../docs/architecture/game/glossary.md) defines each term the game docs
  share, once. A game doc and its diagrams use the glossary's term.
