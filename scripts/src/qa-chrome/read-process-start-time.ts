import { readFile } from 'node:fs/promises';

const STATE_FIELD = 0;
const START_TIME_FIELD = 19;

export async function readProcessStartTime(pid: number): Promise<string | undefined> {
  const stat = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => {});

  if (stat === undefined) {
    return undefined;
  }

  // the command name in field 2 may hold spaces and parentheses, so the fields after it are counted
  // from the last closing parenthesis: state is field 3, and start time is field 22
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');

  // a zombie has exited and keeps its entry only until its parent reaps it
  return fields.at(STATE_FIELD) === 'Z' ? undefined : fields.at(START_TIME_FIELD);
}
