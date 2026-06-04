import { Kafka, logLevel } from 'kafkajs';
import axios from 'axios';
import { readableTraceProtoFromBinary } from '@opentelemetry/otlp-transformer';
import dotenv from 'dotenv';

dotenv.config();

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://clickhouse:8123';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);
const FLUSH_INTERVAL = parseInt(process.env.FLUSH_INTERVAL || '5000', 10);

const kafka = new Kafka({
  clientId: 'otel-consumer',
  brokers: KAFKA_BROKERS,
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

const consumer = kafka.consumer({ groupId: 'otel-consumer-group' });

let tracesBatch = [];
let metricsBatch = [];
let logsBatch = [];

/**
 * Safely escape a string for ClickHouse SQL single-quoted values
 */
function escSql(value) {
  if (typeof value !== 'string') return String(value ?? '');
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Insert spans into ClickHouse
 */
async function insertTraces(spans) {
  if (spans.length === 0) return;

  const sql = `
    INSERT INTO traces (
      TraceId, SpanId, ParentSpanId, ServiceName, OperationName,
      StartTime, EndTime, Duration, StatusCode, StatusMessage,
      Attributes, ResourceAttributes
    ) VALUES
  `;

  const values = spans
    .map(
      (span) => `(
      '${escSql(span.traceId)}',
      '${escSql(span.spanId)}',
      '${escSql(span.parentSpanId || '')}',
      '${escSql(span.serviceName || 'unknown')}',
      '${escSql(span.operationName || 'unknown')}',
      ${span.startTimeUnixNano},
      ${span.endTimeUnixNano},
      ${span.durationNano},
      ${span.statusCode},
      '${escSql(span.statusMessage || '')}',
      {},
      {}
    )`
    )
    .join(',\n');

  try {
    await axios.post(CLICKHOUSE_URL, sql + values, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 5000,
    });
    console.log(`✓ Inserted ${spans.length} traces into ClickHouse`);
  } catch (error) {
    console.error(`✗ Failed to insert traces: ${error.message}`);
    // Rethrow to trigger retry mechanism
    throw error;
  }
}

/**
 * Parse OTLP trace protobuf and flatten to individual spans
 */
function parseTraceMessage(buffer) {
  try {
    // Use otlp-transformer to decode protobuf
    const decoded = readableTraceProtoFromBinary(buffer);

    const spans = [];

    if (decoded.resourceSpans) {
      for (const resourceSpan of decoded.resourceSpans) {
        const serviceName =
          resourceSpan.resource?.attributes?.find(
            (attr) => attr.key === 'service.name'
          )?.value?.stringValue || 'unknown';

        if (resourceSpan.scopeSpans) {
          for (const scopeSpan of resourceSpan.scopeSpans) {
            if (scopeSpan.spans) {
              for (const span of scopeSpan.spans) {
                spans.push({
                  traceId: Buffer.from(span.traceId).toString('hex'),
                  spanId: Buffer.from(span.spanId).toString('hex'),
                  parentSpanId: span.parentSpanId
                    ? Buffer.from(span.parentSpanId).toString('hex')
                    : '',
                  serviceName,
                  operationName: span.name,
                  startTimeUnixNano: span.startTimeUnixNano,
                  endTimeUnixNano: span.endTimeUnixNano,
                  durationNano:
                    (span.endTimeUnixNano || 0) -
                    (span.startTimeUnixNano || 0),
                  statusCode: span.status?.code || 0,
                  statusMessage: span.status?.message || '',
                });
              }
            }
          }
        }
      }
    }

    return spans;
  } catch (error) {
    console.error('Failed to parse trace message:', error.message);
    return [];
  }
}

/**
 * Flush batches to ClickHouse
 */
async function flushBatches() {
  try {
    if (tracesBatch.length > 0) {
      await insertTraces(tracesBatch);
      tracesBatch = [];
    }
    if (metricsBatch.length > 0) {
      console.log(`ℹ Queued ${metricsBatch.length} metrics (not yet implemented)`);
      metricsBatch = [];
    }
    if (logsBatch.length > 0) {
      console.log(`ℹ Queued ${logsBatch.length} logs (not yet implemented)`);
      logsBatch = [];
    }
  } catch (error) {
    console.error('Error flushing batches:', error.message);
  }
}

/**
 * Setup message handlers
 */
async function setupConsumer() {
  await consumer.subscribe({ topics: ['otel.traces', 'otel.metrics', 'otel.logs'] });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        if (topic === 'otel.traces') {
          const spans = parseTraceMessage(message.value);
          tracesBatch.push(...spans);

          if (tracesBatch.length >= BATCH_SIZE) {
            await insertTraces(tracesBatch);
            tracesBatch = [];
          }
        } else if (topic === 'otel.metrics') {
          metricsBatch.push(message.value);
        } else if (topic === 'otel.logs') {
          logsBatch.push(message.value);
        }
      } catch (error) {
        console.error(`Error processing message from ${topic}:`, error.message);
      }
    },
  });

  // Flush batches periodically
  setInterval(flushBatches, FLUSH_INTERVAL);
}

/**
 * Start consumer
 */
async function start() {
  try {
    console.log('🚀 Starting Kafka consumer...');
    console.log(`📊 Kafka brokers: ${KAFKA_BROKERS.join(', ')}`);
    console.log(`📦 ClickHouse: ${CLICKHOUSE_URL}`);

    await consumer.connect();
    console.log('✓ Connected to Kafka');

    await setupConsumer();
    console.log('✓ Consumer ready, listening for messages...');
  } catch (error) {
    console.error('Failed to start consumer:', error.message);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down consumer...');
  await flushBatches();
  await consumer.disconnect();
  console.log('✓ Consumer stopped');
  process.exit(0);
});

start();
