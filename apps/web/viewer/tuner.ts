/**
 * The knob engine and panel. Uniform-backed knobs update their TSL node in place (no rebuild);
 * setter knobs re-apply onto whatever live scene objects the latest build registered. Every
 * value change fires the change listener so the caller can persist the config to disk.
 */
import { uniform } from 'three/tsl';

export type UniformKnob = ReturnType<typeof uniform<number>>;

export interface TunerKnob {
  readonly apply: (value: number) => void;
  readonly defaultValue: number;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly path: string;
  readonly step: number;
  value: number;
}

export const tunerKnobs: Array<TunerKnob> = [];

let changeListener: (() => void) | null = null;

export function subscribeTunerChange(listener: () => void) {
  changeListener = listener;
}

function toKnobLabel(path: string): string {
  return (path.split('.')[1] ?? path).replaceAll(/([A-Z\d])/g, ' $1').toLowerCase();
}

export function makeKnob(path: string, value: number, min: number, max: number, step = 0.01): UniformKnob {
  const node = uniform(value);

  tunerKnobs.push({
    apply: (next) => {
      node.value = next;
    },
    defaultValue: value,
    label: toKnobLabel(path),
    max,
    min,
    path,
    step,
    value,
  });

  return node;
}

export function registerKnob(
  path: string,
  value: number,
  min: number,
  max: number,
  apply: (value: number) => void,
  step = 0.01,
) {
  tunerKnobs.push({ apply, defaultValue: value, label: toKnobLabel(path), max, min, path, step, value });
}

export function applyTunerKnobs() {
  for (const knob of tunerKnobs) {
    knob.apply(knob.value);
  }
}

export function buildTunerConfig(): Record<string, Record<string, number>> {
  const config: Record<string, Record<string, number>> = {};

  for (const knob of tunerKnobs) {
    const [section = 'misc', name = knob.path] = knob.path.split('.');

    (config[section] ??= {})[name] = Math.round(knob.value * 1000) / 1000;
  }

  return config;
}

/** Overlay saved values onto the knob registry — the load half of the persistence loop. */
export function applyKnobValues(values: Record<string, Record<string, number>>) {
  for (const knob of tunerKnobs) {
    const [section = 'misc', name = knob.path] = knob.path.split('.');
    const value = values[section]?.[name];

    if (value !== undefined && Number.isFinite(value)) {
      knob.value = value;
      knob.apply(value);
    }
  }
}

export type KnobSpec = readonly [value: number, min: number, max: number, step?: number];

export function makeKnobGroup<K extends string>(
  section: string,
  specs: Readonly<Record<K, KnobSpec>>,
): Record<K, UniformKnob> {
  const group = {} as Record<K, UniformKnob>;

  for (const key of Object.keys(specs) as Array<K>) {
    const [value, min, max, step] = specs[key];

    group[key] = makeKnob(`${section}.${key}`, value, min, max, step);
  }

  return group;
}

export function renderTunerPanel(container: HTMLElement) {
  // a re-render (reset) keeps whichever sections the user had open
  const openSections = new Set(
    [...container.querySelectorAll('details[open] > summary')].map((summary) => summary.textContent ?? ''),
  );

  container.innerHTML = '';

  const head = document.createElement('div');

  head.className = 'tuner-head';

  const title = document.createElement('span');

  title.textContent = 'tuner';

  const copy = document.createElement('button');

  copy.textContent = 'copy json';
  copy.addEventListener('click', () => {
    const serialized = JSON.stringify(buildTunerConfig(), null, 2);

    console.log(serialized);
    void navigator.clipboard.writeText(serialized).catch(() => {});
    copy.textContent = 'copied';
    setTimeout(() => {
      copy.textContent = 'copy json';
    }, 1200);
  });

  const reset = document.createElement('button');

  reset.textContent = 'reset';
  reset.addEventListener('click', () => {
    for (const knob of tunerKnobs) {
      knob.value = knob.defaultValue;
      knob.apply(knob.value);
    }

    renderTunerPanel(container);
    changeListener?.();
  });

  head.append(title, reset, copy);
  container.appendChild(head);

  const sections = new Map<string, HTMLElement>();

  for (const knob of tunerKnobs) {
    const [sectionKey = 'misc'] = knob.path.split('.');
    let body = sections.get(sectionKey);

    if (!body) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');

      summary.textContent = sectionKey;
      details.open = openSections.has(sectionKey);
      details.appendChild(summary);
      body = document.createElement('div');
      details.appendChild(body);
      container.appendChild(details);
      sections.set(sectionKey, body);
    }

    const row = document.createElement('div');

    row.className = 'tuner-row';

    const label = document.createElement('label');

    label.textContent = knob.label;
    label.title = knob.path;

    const range = document.createElement('input');

    range.type = 'range';
    range.min = String(knob.min);
    range.max = String(knob.max);
    range.step = String(knob.step);
    range.value = String(knob.value);

    const number = document.createElement('input');

    number.type = 'number';
    number.step = String(knob.step);
    number.value = String(knob.value);

    const commit = (raw: string) => {
      const value = Number(raw);

      if (!Number.isFinite(value)) {
        return;
      }

      knob.value = value;
      knob.apply(value);
      range.value = String(value);
      number.value = String(value);
      changeListener?.();
    };

    range.addEventListener('input', () => commit(range.value));
    number.addEventListener('change', () => commit(number.value));
    row.append(label, range, number);
    body.appendChild(row);
  }
}
