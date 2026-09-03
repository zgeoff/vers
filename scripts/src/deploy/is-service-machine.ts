interface ServiceMachineProbe {
  readonly config?:
    | {
        readonly metadata?: Readonly<Record<string, string>> | undefined;
        readonly schedule?: string | undefined;
      }
    | undefined;
}

// machines outside the `app` process group (release commands, builders) always carry an explicit
// group stamp, so the absent-metadata default applies only to bare app machines
export function isServiceMachine(machine: ServiceMachineProbe): boolean {
  return (
    machine.config?.schedule === undefined &&
    (machine.config?.metadata?.['fly_process_group'] ?? 'app') === 'app'
  );
}
