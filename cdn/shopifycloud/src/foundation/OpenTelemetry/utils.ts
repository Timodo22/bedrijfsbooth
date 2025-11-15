import type {
  LogObject,
  OpenTelemetryExporter,
  MetricObject,
} from '@shopify/opentelemetry-mini-client-private';
import {OpenTelemetryJSONExporter} from '@shopify/opentelemetry-mini-client-private';

import {ExporterWithRetries} from './ExporterWithRetries';
import type {OpentelErrorGroup} from './types';

const opentelErrorGrouping: Record<OpentelErrorGroup, string> = {
  blockedRequest: 'Blocked Request',
  emptyeEventCreatedAtMs: 'event_created_at_ms metadata field cannot be empty',
  errorParsingCreatedAtMs: 'Error parsing: X-Monorail-Edge-Event-Created-At-Ms',
  failedToReadRequestBody: 'Failed to read request body',
  incorrectContentType:
    'Incorrect Content-Type. Expected: application/json or text/plain',
  methodNotAllowed: 'Method Not Allowed',
  noPermissionToGetURL: 'Your client does not have permission to get URL',
  noResponseFromEdge: 'No response from edge',
  schemaValidationError: 'Schema validation error',
};

export function groupOpentelError(caughtError: Error) {
  const groupEntry = Object.values(opentelErrorGrouping).find(([_, value]) =>
    caughtError.message.includes(value),
  );
  return groupEntry?.[0] || 'otherErrors';
}

export const OPEN_TELEMETRY_ENDPOINT =
  'https://otlp-http-production.shopifysvc.com/v1/metrics';

export function createExporter(): OpenTelemetryExporter {
  // eslint-disable-next-line no-process-env
  if (process.env.NODE_ENV === 'production') {
    const metricExporter = new OpenTelemetryJSONExporter(
      OPEN_TELEMETRY_ENDPOINT,
      'shop-js',
    );
    return new ExporterWithRetries(metricExporter);
  }

  return consoleExporter;
}

const consoleExporter: OpenTelemetryExporter = {
  async exportMetrics(metrics: MetricObject[]) {
    // eslint-disable-next-line no-console
    console.log(`\x1b[36m [Log: metrics]: \x1b[0m`, JSON.stringify(metrics));
    return Promise.resolve();
  },
  async exportLogs(logs: LogObject[]) {
    // eslint-disable-next-line no-console
    console.log(`\x1b[36m [Log: logs]: \x1b[0m`, JSON.stringify(logs));
    return Promise.resolve();
  },
};
