interface DiscordAlert {
  readonly title: string;
  readonly runURL: string;
  readonly description: string;
  readonly failedJobs: string | undefined;
}

interface DiscordEmbedField {
  readonly name: string;
  readonly value: string;
}

interface DiscordEmbed {
  readonly title: string;
  readonly url: string;
  readonly description: string;
  readonly color: number;
  readonly fields?: ReadonlyArray<DiscordEmbedField>;
}

interface DiscordWebhookBody {
  readonly embeds: ReadonlyArray<DiscordEmbed>;
}

// the critical hue the Axiom notifiers share, so every alarm in the channel reads alike
const CRITICAL_COLOR = 15_026_253;

export function buildDiscordAlert(alert: Readonly<DiscordAlert>): DiscordWebhookBody {
  const [subject = ''] = alert.description.split('\n', 1);

  const embed: DiscordEmbed = {
    title: alert.title,
    url: alert.runURL,
    description: subject,
    color: CRITICAL_COLOR,
    ...(alert.failedJobs === undefined
      ? {}
      : { fields: [{ name: 'Failed jobs', value: alert.failedJobs }] }),
  };

  return { embeds: [embed] };
}
