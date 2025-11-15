import type {
  LogObject,
  MetricObject,
  OpenTelemetryExporter,
  OpenTelemetryLogsExporter,
  OpenTelemetryMetricsExporter,
} from '@shopify/opentelemetry-mini-client-private';
import {OpenTelemetryClientError} from '@shopify/opentelemetry-mini-client-private';

export class ExporterWithRetries
  implements OpenTelemetryMetricsExporter, OpenTelemetryLogsExporter
{
  #exporter: OpenTelemetryExporter;

  constructor(exporter: OpenTelemetryExporter) {
    this.#exporter = exporter;
  }

  async exportMetrics(metrics: MetricObject[]): Promise<void> {
    try {
      await this.#exporter.exportMetrics(metrics);
    } catch (error) {
      if (error instanceof OpenTelemetryClientError) {
        const retryAfter = error.metadata?.retryAfter;

        if (retryAfter) {
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              return this.exportMetrics(metrics).finally(resolve);
            }, retryAfter.seconds * 1_000);
          });

          return;
        }
      }

      throw error;
    }
  }

  async exportLogs(logs: LogObject[]): Promise<void> {
    try {
      await this.#exporter.exportLogs(logs);
    } catch (error) {
      if (error instanceof OpenTelemetryClientError) {
        const retryAfter = error.metadata?.retryAfter;

        if (retryAfter) {
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              return this.exportLogs(logs).finally(resolve);
            }, retryAfter.seconds * 1_000);
          });

          return;
        }
      }

      throw error;
    }
  }
}
