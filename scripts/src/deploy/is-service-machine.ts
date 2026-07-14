interface ServiceMachineProbe {
  readonly config?:
    | {
        readonly metadata?: Readonly<Record<string, string>> | undefined;
        readonly schedule?: string | undefined;
      }
    | undefined;
}

/**
 * True for a machine that serves the app's traffic: no `config.schedule`
 * (that marks a `fly machine run --schedule` machine) and a
 * `fly_process_group` of `app`. Machines outside the `app` process group
 * (release commands, builders) always carry an explicit group stamp, so the
 * absent-metadata default applies only to bare app machines.
 */
export function isServiceMachine(machine: ServiceMachineProbe): boolean {
  return (
    machine.config?.schedule === undefined &&
    (machine.config?.metadata?.['fly_process_group'] ?? 'app') === 'app'
  );
}
