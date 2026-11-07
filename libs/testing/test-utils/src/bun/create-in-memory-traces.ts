import { onTestFinished } from 'bun:test';
import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';

interface InMemoryTraces {
  readonly exporter: InMemorySpanExporter;
}

export function createInMemoryTraces(): InMemoryTraces {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });

  trace.setGlobalTracerProvider(provider);
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  onTestFinished(async () => {
    context.disable();
    propagation.disable();
    trace.disable();

    await provider.shutdown();
  });

  return { exporter };
}
