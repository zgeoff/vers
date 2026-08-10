import { onTestFinished } from 'bun:test';
import type { Attributes } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api';
import {
  AggregationTemporality,
  DataPointType,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';

interface InMemoryMetrics {
  /**
   * Flushes the reader and returns the named counter's data points, one per distinct attribute
   * combination recorded in this test.
   */
  readonly readCounterDataPoints: (name: string) => Promise<ReadonlyArray<CounterDataPoint>>;

  /**
   * Flushes the reader and returns the latest cumulative value of the named counter, or undefined
   * when nothing has recorded it in this test.
   */
  readonly readCounterValue: (name: string) => Promise<number | undefined>;

  /**
   * Flushes the reader and returns the named histogram's data points, one per distinct attribute
   * combination recorded in this test.
   */
  readonly readHistogramDataPoints: (name: string) => Promise<ReadonlyArray<HistogramDataPoint>>;
}

interface CounterDataPoint {
  readonly attributes: Attributes;
  readonly value: number;
}

/**
 * `sum` is absent for a histogram configured without one, so a test reading it asserts on the
 * recorded total only where the instrument keeps one.
 */
interface HistogramDataPoint {
  readonly attributes: Attributes;
  readonly count: number;
  readonly sum: number | undefined;
}

/**
 * Registers an in-memory OTel meter provider as the process-global provider for the current test,
 * so code resolving instruments through the global metrics API records into it, and tears it down
 * when the test finishes. The export interval is effectively infinite — the readers force a flush
 * on demand rather than waiting on a periodic reader.
 */
export function createInMemoryMetrics(): InMemoryMetrics {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);

  const provider = new MeterProvider({
    readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 3_600_000 })],
  });

  metrics.setGlobalMeterProvider(provider);

  onTestFinished(async () => {
    metrics.disable();

    await provider.shutdown();
  });

  const readMetric = async (name: string) => {
    await provider.forceFlush();

    return exporter
      .getMetrics()
      .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
      .flatMap((scopeMetrics) => scopeMetrics.metrics)
      .find((candidate) => candidate.descriptor.name === name);
  };

  const readCounterDataPoints = async (name: string): Promise<ReadonlyArray<CounterDataPoint>> => {
    const metric = await readMetric(name);

    if (metric === undefined || metric.dataPointType !== DataPointType.SUM) {
      return [];
    }

    return metric.dataPoints.map((dataPoint) => ({
      attributes: dataPoint.attributes,
      value: dataPoint.value,
    }));
  };

  return {
    readCounterDataPoints,
    async readCounterValue(name) {
      const dataPoints = await readCounterDataPoints(name);

      return dataPoints[0]?.value;
    },
    async readHistogramDataPoints(name) {
      const metric = await readMetric(name);

      if (metric === undefined || metric.dataPointType !== DataPointType.HISTOGRAM) {
        return [];
      }

      return metric.dataPoints.map((dataPoint) => ({
        attributes: dataPoint.attributes,
        count: dataPoint.value.count,
        sum: dataPoint.value.sum,
      }));
    },
  };
}
