// The skill gate's entry point, which repo-sync delivers from zgeoff/tools. The gate lives in
// @zgeoff/skill-gate, which the repo installs at its root.
import { runSkillGate } from '@zgeoff/skill-gate';

await runSkillGate();
