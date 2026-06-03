import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
const serviceName = process.env.SERVICE_NAME || 'api-gateway';
const environment = process.env.OTEL_RESOURCE_ATTRIBUTES || 'deployment.environment=dev';

const traceExporter = new OTLPTraceExporter({ url: otelEndpoint });

const metricExporter = new OTLPMetricExporter({ url: otelEndpoint });

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  intervalMillis: 10000,
});

const sdk = new NodeSDK({
  serviceName,
  traceExporter,
  metricReader,
  instrumentations: [getNodeAutoInstrumentations()],
  resourceAttributes: {
    'deployment.environment': environment.split('=')[1] || 'dev',
  },
});

sdk.start();

console.log(`✓ OpenTelemetry tracing initialized for ${serviceName}`);
console.log(`✓ Endpoint: ${otelEndpoint}`);

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((log) => console.log('Error terminating tracing', log))
    .finally(() => process.exit(0));
});
