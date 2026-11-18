import { writeDiscordAlert } from '../ci/write-discord-alert';

const outcome = await writeDiscordAlert(process.env);

if (outcome === 'no-webhook') {
  console.log('DISCORD_WEBHOOK_URL not configured; skipping alert');
}

if (outcome === 'superseded') {
  console.log(
    'a job was cancelled and a newer run exists, which reports for both commits; no alert',
  );
}
