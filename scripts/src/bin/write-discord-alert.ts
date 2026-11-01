import { writeDiscordAlert } from '../ci/write-discord-alert';

// Posts a failed run's alert to the team's Discord channel. The step passes WEBHOOK_URL, RUN_URL,
// ALERT_TITLE, ALERT_DESCRIPTION and, for the main pipeline, ALERT_FAILED_JOBS, CANCELLED_NEED and
// GITHUB_TOKEN through env.

const outcome = await writeDiscordAlert(process.env);

if (outcome === 'no-webhook') {
  console.log('DISCORD_WEBHOOK_URL not configured; skipping alert');
}

if (outcome === 'superseded') {
  console.log(
    'a job was cancelled and a newer run exists, which reports for both commits; no alert',
  );
}
