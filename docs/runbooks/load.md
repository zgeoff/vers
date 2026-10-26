# Load runs

A load run measures the activity and replay pipeline under the way people play: players with the
game open, players who return together after a gap, and play through a dependency outage. One
command builds the production images of the pipeline's apps from the current checkout, boots them as
an isolated compose stack, drives typed clients through app-web's RPC proxy, and writes a report of
settlement age, completed work, transaction wait, resource use, and delivery failures. Production is
never touched: every scenario runs against its own fresh stack on the local machine.

## What a run exercises

Each scenario boots a fresh stack, so one scenario's backlog never weighs on the next. The stack
holds app-web, the activity, keys, session, and replay services, a second replay provider, and
postgres, each container capped at the memory and CPU of its Fly machine. The second provider is the
replay image built under another engine hash, with a registry row of its own, so the share of
players that `--retained-every` sets stamps a retained sim version and the verifier replays that
player's segments over the cross-version dispatch path. Both versions run the same engine code, so
the retained share measures the dispatch path, not old code.

Players sign in through the session service and carry the sealed cookie app-web reads, so every call
takes the production path: app-web resolves the session and forwards the call to the activity
service with the client's retry policy. Each player's avatar starts at a level from a fixed corpus,
and its own scope secret seals the origin's encounter, so the attempts mix failed and completed
fights of different lengths. A player index always gets the same level and map seed, so a rerun
replays the same workload.

| Scenario         | Players                                                       | Measured window                                           |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| `steady-<n>`     | a ramp of connected players, one step per count               | live play at the client's flush interval, then the drain  |
| `offline-return` | players who closed the game on a fresh activity               | every fast-forward delivered at once, then the settlement |
| `recovery`       | connected players while one dependency stops and starts again | the outage, the backlog it leaves, and its drain          |

The compose stack runs no scheduled replay drain, so between wake requests nothing retries a
backed-off activity until a later append or a progression read wakes the verifier. A recovery
scenario measures that path.

## Running it

You need Docker with Compose, the repo's pinned Bun, and free host ports 3400, 3401, and 5733. A run
with the default volumes takes about 50 minutes and holds about 9 CPUs and 10 GB of memory while a
stack is up, so run nothing else heavy beside it.

1. Run every scenario from the repo root:

   ```bash
   bun run --cwd libs/testing/load-harness load
   ```

   Expect a log line per scenario stage, ending with `report: <path>`.

2. Run one scenario, or other volumes, with the options that `--help` lists:

   ```bash
   bun run --cwd libs/testing/load-harness load --scenario offline-return --offline-players 100 --offline-hours 24
   bun run --cwd libs/testing/load-harness load --scenario recovery --outage-service service-replay --skip-build
   ```

   `--skip-build` reuses the images an earlier run built for the same commit.

3. Read the report at the printed path, under `.load-results/<timestamp>/`. The folder also holds
   `run.log` and one JSON recording per scenario with every sample the report summarises.

A run removes each stack when its scenario ends, whether the scenario passed or failed. If a run is
killed part way, remove the stack it left:

```bash
docker compose -p vers-load -f libs/testing/load-harness/docker-compose.load.yml down -v
```

## Reading the report

The capacity table rates each steady step against the settlement target, which
`--settlement-target-seconds` sets. A step meets the target when the settlement age p95 is within
it, no call failed, no activity is held or rejected, and every appended checkpoint was proved once
play stopped. The supported capacity is the largest step that met the target, and the busiest
container of that step is the next limiting resource. The report counts connected players apart from
the simulated hours they delivered, because one connected player delivers one simulated hour per
wall hour while a returning player delivers the whole gap at once.

- **Settlement age** is the time from a checkpoint's append to the segment apply that proved it. The
  database clock stamps both, so the sample interval sets no resolution. Two applies on one activity
  between samples read as the later one.
- **Lock waits** come from postgres, which logs every lock wait that outlasts its deadlock timeout,
  and from the samples' count of backends waiting on a lock.
- **Resource use** comes from `docker stats`. Fly's shared CPUs throttle to a baseline quota once
  their burst balance runs out. The default `--cpu-profile burst` gives each service container a
  whole CPU, the burst rate, so a container that runs above the baseline share here outruns its
  sustained share on Fly. `--cpu-profile baseline` caps each service container at the baseline quota
  instead, and measures what the fleet sustains after its burst balance is spent.
- **Failed calls** counts every call that failed after the client's retries, by status. A player
  keeps an undelivered start or batch and resends it at its next flush, as the client's outbox does,
  so a failed call during an outage is a delay, not lost work. A service that cannot reach a
  dependency answers 5xx, an infrastructure fault in the
  [error-handling taxonomy](../architecture/services/error-handling.md).
- **End state** counts unproved checkpoints, held activities, and XP that differs from what the
  players' own streams earned. Any of them is a lost reward or a stuck avatar, never noise.
