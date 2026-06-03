# Distributed Tracing & Observability Platform — Build Roadmap

> **Stack constraint:** 100% free/open-source. No paid APIs, no paid SaaS.  
> **Goal:** Production-ready observability platform with AI-powered anomaly detection and root-cause analysis using a local LLM.  
> **Target timeline:** 4 weeks

---

## Tech Stack (All Free / Open-Source)

| Layer | Technology | Why |
|---|---|---|
| Instrumentation | OpenTelemetry SDK (Node.js + Python) | Industry standard, zero-cost |
| Collection | OpenTelemetry Collector (otelcol-contrib) | Routes spans/metrics/logs |
| Message broker | Apache Kafka (via Docker) | Decouples ingest from storage |
| Storage | ClickHouse (via Docker) | Columnar OLAP, best for trace queries |
| LLM / AI | Ollama + `llama3` (local) | Free, runs on CPU, no API key |
| Query API | Node.js + Express | REST API over ClickHouse |
| Cache | Redis (via Docker) | Service map query caching |
| Dashboard | React + Recharts + React Flow | Trace explorer + service graph |
| Containerisation | Docker + Docker Compose | One-command full stack |
| Deployment | AWS EC2 free tier (t2.micro) | Live URL for portfolio |

---

## Project Structure

```
observability-platform/
├── services/
│   ├── api-gateway/           # Node.js demo service
│   ├── order-service/         # Python FastAPI demo service
│   └── payment-service/       # Node.js demo service
├── collector/
│   └── otelcol-config.yaml    # OTel Collector config
├── kafka-consumer/            # Node.js: reads Kafka → writes ClickHouse
├── query-api/                 # Node.js Express: queries ClickHouse + Ollama
├── dashboard/                 # React frontend
├── infra/
│   ├── clickhouse/
│   │   └── init.sql           # Schema DDL + materialised views
│   └── docker-compose.yml     # Full stack
└── README.md
```

---

## Phase 1 — Demo Microservices with OpenTelemetry Instrumentation

**Duration:** Days 1–3  
**Goal:** Three realistic demo services that emit real OpenTelemetry spans, metrics, and logs via OTLP/gRPC to a Collector endpoint.

### Services to build

#### `api-gateway` (Node.js + Express)
- Exposes `GET /order/:id` — internally calls `order-service` via HTTP
- Exposes `GET /pay/:orderId` — internally calls `payment-service` via HTTP
- Simulates realistic behaviour: random 50–300ms processing delay, 10% chance of returning a 500 error

#### `order-service` (Python FastAPI)
- Exposes `GET /order/:id` — returns fake order JSON
- Simulates DB query: add `asyncio.sleep(random 20–150ms)`
- 5% chance of raising an exception (to generate error spans)

#### `payment-service` (Node.js + Express)
- Exposes `POST /pay` — returns fake payment confirmation
- Simulates downstream payment gateway call: random 100–400ms delay
- 8% chance of timeout error

### OpenTelemetry setup (each service)

**Node.js services — install:**
```bash
npm install @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-grpc \
  @opentelemetry/exporter-metrics-otlp-grpc
```

**Create `tracing.js` in each Node.js service (loaded before app start):**
```js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

const sdk = new NodeSDK({
  serviceName: process.env.SERVICE_NAME,
  traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
    exportIntervalMillis: 10000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

**Python (order-service) — install:**
```bash
pip install opentelemetry-sdk \
  opentelemetry-instrumentation-fastapi \
  opentelemetry-exporter-otlp-proto-grpc \
  opentelemetry-instrumentation-httpx
```

**Configure `traceparent` propagation:** Every outgoing HTTP call from `api-gateway` must inject `traceparent` header so the full trace is linked across services. `@opentelemetry/auto-instrumentations-node` does this automatically for `http`/`axios` calls.

### Environment variables (per service)
```env
SERVICE_NAME=api-gateway          # or order-service, payment-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=dev
```

### Acceptance criteria
- [ ] All 3 services start without errors
- [ ] `api-gateway` calls other services and trace context propagates (same `traceId` appears in all 3 service logs)
- [ ] Error spans are generated on the simulated failure paths
- [ ] Metrics (request count, latency histogram) are emitted every 10s

---

## Phase 2 — OTel Collector + Kafka Pipeline

**Duration:** Days 3–5  
**Goal:** Collector receives all OTLP signals from services, fans them out to three Kafka topics. Kafka consumer reads and bulk-inserts into ClickHouse.

### OTel Collector config (`collector/otelcol-config.yaml`)

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 1000
  memory_limiter:
    limit_mib: 256
    spike_limit_mib: 64
    check_interval: 5s
  resource:
    attributes:
      - action: insert
        key: collector.version
        value: "1.0"

exporters:
  kafka/traces:
    brokers: ["kafka:9092"]
    topic: otel.traces
    encoding: otlp_proto
  kafka/metrics:
    brokers: ["kafka:9092"]
    topic: otel.metrics
    encoding: otlp_proto
  kafka/logs:
    brokers: ["kafka:9092"]
    topic: otel.logs
    encoding: otlp_proto

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource]
      exporters: [kafka/traces]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [kafka/metrics]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [kafka/logs]
```

### Kafka consumer (`kafka-consumer/`)

**Install:**
```bash
npm install kafkajs @opentelemetry/otlp-transformer
```

**Logic:**
- Connect to topic `otel.traces`
- Deserialise `ExportTraceServiceRequest` protobuf message
- Flatten nested span tree into individual span rows
- Bulk insert into ClickHouse `traces` table via HTTP interface (`http://clickhouse:8123`)
- Repeat for `otel.metrics` → `metrics` table, `otel.logs` → `logs` table
- Commit Kafka offset only after successful ClickHouse insert (at-least-once delivery)

### Acceptance criteria
- [ ] Collector starts and receives spans from all 3 services (check Collector logs)
- [ ] 3 Kafka topics exist and messages accumulate (verify with `kafka-console-consumer`)
- [ ] Kafka consumer inserts rows into ClickHouse — run `SELECT count() FROM traces` and see rows increasing
- [ ] If ClickHouse is stopped, Kafka retains messages and consumer catches up on restart

---

## Phase 3 — ClickHouse Schema

**Duration:** Days 5–7  
**Goal:** Efficient storage schema for traces, metrics, and logs with proper ordering keys, compression, and TTL. Materialised views for pre-computed aggregations.

### `infra/clickhouse/init.sql`

```sql
-- Traces table
CREATE TABLE IF NOT EXISTS traces (
  TraceId        String,
  SpanId         String,
  ParentSpanId   String,
  ServiceName    LowCardinality(String),
  OperationName  String,
  StartTime      DateTime64(9, 'UTC'),
  EndTime        DateTime64(9, 'UTC'),
  Duration       UInt64,  -- nanoseconds
  StatusCode     UInt8,   -- 0=unset, 1=ok, 2=error
  StatusMessage  String,
  Attributes     Map(String, String),
  ResourceAttributes Map(String, String)
) ENGINE = MergeTree()
ORDER BY (ServiceName, StartTime)
PARTITION BY toYYYYMMDD(StartTime)
TTL StartTime + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Metrics table
CREATE TABLE IF NOT EXISTS metrics (
  ServiceName    LowCardinality(String),
  MetricName     LowCardinality(String),
  MetricType     LowCardinality(String),
  Timestamp      DateTime64(9, 'UTC'),
  Value          Float64,
  Attributes     Map(String, String)
) ENGINE = MergeTree()
ORDER BY (ServiceName, MetricName, Timestamp)
TTL Timestamp + INTERVAL 7 DAY;

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
  ServiceName    LowCardinality(String),
  Timestamp      DateTime64(9, 'UTC'),
  SeverityText   LowCardinality(String),
  SeverityNumber UInt8,
  Body           String,
  TraceId        String,
  SpanId         String,
  Attributes     Map(String, String)
) ENGINE = MergeTree()
ORDER BY (ServiceName, Timestamp)
TTL Timestamp + INTERVAL 14 DAY;

-- Materialised view: p99 latency per service per minute
CREATE MATERIALIZED VIEW IF NOT EXISTS service_latency_mv
ENGINE = AggregatingMergeTree()
ORDER BY (ServiceName, Minute)
POPULATE AS
SELECT
  ServiceName,
  toStartOfMinute(StartTime) AS Minute,
  quantileState(0.50)(Duration) AS p50_state,
  quantileState(0.95)(Duration) AS p95_state,
  quantileState(0.99)(Duration) AS p99_state,
  countState() AS request_count_state,
  sumState(StatusCode = 2 ? 1 : 0) AS error_count_state
FROM traces
GROUP BY ServiceName, Minute;

-- View to query the materialised view
CREATE VIEW IF NOT EXISTS service_latency AS
SELECT
  ServiceName,
  Minute,
  quantileMerge(0.50)(p50_state)    AS p50_ns,
  quantileMerge(0.95)(p95_state)    AS p95_ns,
  quantileMerge(0.99)(p99_state)    AS p99_ns,
  countMerge(request_count_state)   AS total_requests,
  sumMerge(error_count_state)       AS error_count
FROM service_latency_mv
GROUP BY ServiceName, Minute
ORDER BY Minute DESC;

-- Trace insights table (LLM outputs stored here)
CREATE TABLE IF NOT EXISTS trace_insights (
  TraceId        String,
  ServiceName    LowCardinality(String),
  AnalysedAt     DateTime DEFAULT now(),
  RootCause      String,
  AffectedSpans  Array(String),
  Severity       LowCardinality(String)  -- low / medium / high / critical
) ENGINE = MergeTree()
ORDER BY (ServiceName, AnalysedAt)
TTL AnalysedAt + INTERVAL 30 DAY;
```

### Acceptance criteria
- [ ] All tables created without errors
- [ ] Insert a test span row manually, verify it appears in `SELECT`
- [ ] Materialised view `service_latency_mv` auto-populates as traces insert
- [ ] `SELECT quantileMerge(0.99)(p99_state) FROM service_latency_mv GROUP BY ServiceName` returns data

---

## Phase 4 — Query API

**Duration:** Days 7–12  
**Goal:** REST API exposing trace data, service dependency graph, metrics, and anomaly alerts. Redis caching for expensive queries.

### Install
```bash
npm install express axios node-fetch redis @clickhouse/client
```

### Endpoints to implement

#### `GET /api/traces` — list recent traces
Query params: `service`, `status` (ok/error), `from`, `to`, `limit`
```sql
SELECT TraceId, ServiceName, OperationName, StartTime, Duration, StatusCode
FROM traces
WHERE ServiceName = {service}
  AND StartTime BETWEEN {from} AND {to}
  AND StatusCode = {status}
ORDER BY StartTime DESC
LIMIT {limit}
```

#### `GET /api/traces/:traceId` — full trace tree
Returns all spans for a trace, nested by `ParentSpanId` into a tree structure in JS before returning.
```sql
SELECT * FROM traces WHERE TraceId = {traceId} ORDER BY StartTime ASC
```

#### `GET /api/services` — service dependency map (Redis cached, TTL 30s)
```sql
SELECT DISTINCT
  source.ServiceName AS source,
  target.ServiceName AS target,
  count() AS call_count,
  avg(target.Duration) AS avg_latency_ns
FROM traces AS source
JOIN traces AS target ON source.SpanId = target.ParentSpanId
  AND source.TraceId = target.TraceId
WHERE source.StartTime > now() - INTERVAL 1 HOUR
GROUP BY source, target
```

#### `GET /api/metrics` — latency + error rate per service
Query params: `service`, `window` (1h/6h/24h)
```sql
SELECT ServiceName, Minute, p99_ns, p50_ns, total_requests, error_count
FROM service_latency
WHERE ServiceName = {service}
  AND Minute > now() - INTERVAL {window}
ORDER BY Minute ASC
```

#### `GET /api/alerts` — active anomalies
```sql
SELECT ServiceName, Minute, p99_ns,
  avg(p99_ns) OVER (
    PARTITION BY ServiceName
    ORDER BY Minute
    ROWS BETWEEN 60 PRECEDING AND 1 PRECEDING
  ) AS rolling_avg_p99
FROM service_latency
HAVING p99_ns > rolling_avg_p99 * 2
ORDER BY Minute DESC
LIMIT 50
```

#### `GET /api/insights/:traceId` — LLM root cause (see Phase 5)

### Acceptance criteria
- [ ] All endpoints return correct data
- [ ] `/api/services` hits Redis on second call (log cache hit)
- [ ] `/api/alerts` returns rows when a service has a latency spike (simulate by adding `sleep(2000)` to payment-service temporarily)
- [ ] API handles ClickHouse being slow — add 10s timeout and return 503

---

## Phase 5 — Local LLM Anomaly Detection (Ollama)

**Duration:** Days 12–16  
**Goal:** Background worker that analyses error traces using a local Ollama LLM. No OpenAI. No API key. Runs entirely on-machine.

### Setup Ollama
```bash
# Install Ollama (free, runs locally)
curl -fsSL https://ollama.com/install.sh | sh

# Pull llama3 model (one-time, ~4GB)
ollama pull llama3

# Ollama runs HTTP server at http://localhost:11434
```

**In Docker Compose**, run Ollama as a service:
```yaml
ollama:
  image: ollama/ollama
  volumes:
    - ollama_data:/root/.ollama
  ports:
    - "11434:11434"
```

Pre-pull model on container start:
```yaml
command: >
  sh -c "ollama serve & sleep 5 && ollama pull llama3 && wait"
```

### Background worker (`query-api/workers/trace-analyser.js`)

**Logic — runs every 60 seconds:**
1. Query ClickHouse for error traces in last 5 minutes not yet in `trace_insights`
2. For each error trace, fetch all spans
3. Build a structured prompt
4. Call Ollama API
5. Parse response, insert into `trace_insights`

**Prompt template:**
```
You are a distributed systems expert. Analyse this trace from a microservices system and identify the root cause of the error.

Trace ID: {traceId}
Services involved: {serviceList}

Spans (in order):
{spans.map(s => `- [${s.ServiceName}] ${s.OperationName} | duration: ${s.Duration/1e6}ms | status: ${s.StatusCode === 2 ? 'ERROR' : 'OK'} ${s.StatusMessage ? '| error: ' + s.StatusMessage : ''}`).join('\n')}

Respond in JSON only:
{
  "root_cause": "one sentence description of what went wrong",
  "affected_service": "name of the service that originated the error",
  "severity": "low|medium|high|critical",
  "recommendation": "one sentence fix suggestion"
}
```

**Call Ollama:**
```js
const response = await fetch('http://ollama:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama3',
    prompt: prompt,
    stream: false,
    format: 'json'
  })
});
const data = await response.json();
const insight = JSON.parse(data.response);
```

### Acceptance criteria
- [ ] Ollama container starts and `llama3` model is available
- [ ] Worker runs every 60s and processes new error traces
- [ ] `SELECT * FROM trace_insights` shows rows with non-empty `RootCause`
- [ ] `GET /api/insights/:traceId` returns the LLM analysis for an errored trace
- [ ] Worker skips traces already in `trace_insights` (no duplicate analysis)

---

## Phase 6 — React Dashboard

**Duration:** Days 16–24  
**Goal:** Three-view dashboard — trace explorer, service dependency graph, metrics overview — with AI insights panel.

### Install
```bash
npx create-react-app dashboard --template typescript
npm install recharts reactflow @tanstack/react-query axios
```

### View 1: Trace Explorer (`/traces`)
- Filter bar: service dropdown, status toggle (all/error/ok), time range picker
- Results table: `TraceId`, `Service`, `Operation`, `Duration`, `Status`, timestamp
- Click a row → opens Trace Detail panel

**Trace Detail panel:**
- Span waterfall: each span is a `div` with `width = (span.Duration / totalTraceDuration) * 100%`, `left = (span.StartTime - traceStart) / totalTraceDuration * 100%`
- Color by service (consistent color map)
- Click span → tooltip showing all `Attributes`
- If trace has an insight → show AI root cause card below waterfall

### View 2: Service Graph (`/services`)
- Use `reactflow` — fetch `/api/services`, map to nodes and edges
- Node size proportional to request volume
- Edge thickness proportional to call count
- Edge color: green if avg latency < 200ms, amber if < 500ms, red if > 500ms
- Auto-layout with `reactflow`'s dagre layout

### View 3: Metrics (`/metrics`)
- Service selector dropdown
- Time window buttons: 1h / 6h / 24h
- Three Recharts `LineChart` components: p50/p95/p99 latency (nanoseconds → milliseconds), request rate (requests/min), error rate (%)
- Alerts section below charts: list from `/api/alerts` with severity badges

### AI Insights panel (sidebar)
- Shows 10 most recent entries from `trace_insights`
- Each card: service name, severity badge, root cause text, timestamp
- Click → navigates to trace detail

### Acceptance criteria
- [ ] All 3 views render with live data
- [ ] Span waterfall renders correctly — spans don't overflow, parent/child relationships are visible via indentation
- [ ] Service graph shows all 3 demo services as nodes with edges between them
- [ ] Metrics charts update when time window changes
- [ ] AI insights panel shows LLM-generated root cause for error traces

---

## Phase 7 — Docker Compose + Deployment

**Duration:** Days 24–28  
**Goal:** Single `docker-compose up` starts the entire stack. Deployed to EC2 with live URL.

### `infra/docker-compose.yml`

```yaml
version: '3.8'

services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "2181"]
      interval: 10s

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      zookeeper:
        condition: service_healthy
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    healthcheck:
      test: ["CMD", "kafka-topics", "--bootstrap-server", "localhost:9092", "--list"]
      interval: 15s

  clickhouse:
    image: clickhouse/clickhouse-server:23.8
    ports:
      - "8123:8123"
      - "9000:9000"
    volumes:
      - ./clickhouse/init.sql:/docker-entrypoint-initdb.d/init.sql
      - clickhouse_data:/var/lib/clickhouse
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8123/ping"]
      interval: 10s

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s

  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    entrypoint: >
      sh -c "ollama serve & sleep 10 && ollama pull llama3 && wait"

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.91.0
    command: ["--config=/etc/otelcol-contrib/config.yaml"]
    volumes:
      - ../collector/otelcol-config.yaml:/etc/otelcol-contrib/config.yaml
    ports:
      - "4317:4317"
      - "4318:4318"
    depends_on:
      kafka:
        condition: service_healthy

  api-gateway:
    build: ../services/api-gateway
    environment:
      SERVICE_NAME: api-gateway
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
      ORDER_SERVICE_URL: http://order-service:3001
      PAYMENT_SERVICE_URL: http://payment-service:3002
    depends_on: [otel-collector]

  order-service:
    build: ../services/order-service
    environment:
      SERVICE_NAME: order-service
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317

  payment-service:
    build: ../services/payment-service
    environment:
      SERVICE_NAME: payment-service
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317

  kafka-consumer:
    build: ../kafka-consumer
    environment:
      KAFKA_BROKERS: kafka:9092
      CLICKHOUSE_URL: http://clickhouse:8123
    depends_on:
      kafka:
        condition: service_healthy
      clickhouse:
        condition: service_healthy

  query-api:
    build: ../query-api
    ports:
      - "4000:4000"
    environment:
      CLICKHOUSE_URL: http://clickhouse:8123
      REDIS_URL: redis://redis:6379
      OLLAMA_URL: http://ollama:11434
    depends_on: [clickhouse, redis, ollama]

  dashboard:
    build: ../dashboard
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:4000

volumes:
  clickhouse_data:
  ollama_data:
```

### EC2 Deployment (free tier)
1. Launch `t2.micro` Ubuntu 22.04 instance (free tier eligible)
2. Install Docker + Docker Compose on instance
3. Clone repo, run `cd infra && docker-compose up -d`
4. Open ports 3000 (dashboard) and 4000 (API) in EC2 security group
5. Dashboard live at `http://<ec2-public-ip>:3000`

### Acceptance criteria
- [ ] `docker-compose up` from cold start brings entire stack up in < 3 minutes
- [ ] Demo services generate continuous traffic automatically (add a load generator script that calls `api-gateway` every 2s)
- [ ] Dashboard shows live data at the EC2 public URL
- [ ] `README.md` contains: architecture diagram, setup instructions, benchmark numbers

---

## Load Generator Script (`infra/load-gen.sh`)

Add this so the system always has live data to show — critical for demos:

```bash
#!/bin/bash
# Generates continuous traffic against api-gateway
API="http://localhost:3000"
ORDER_IDS=(101 102 103 104 105)

while true; do
  ID=${ORDER_IDS[$RANDOM % ${#ORDER_IDS[@]}]}
  curl -s "$API/order/$ID" > /dev/null
  sleep 1

  curl -s "$API/pay/$ID" > /dev/null
  sleep 1
done
```

Run: `chmod +x load-gen.sh && ./load-gen.sh &`

---

## README Benchmark Targets (put these in README after build)

| Metric | Target |
|---|---|
| Spans ingested/sec | > 500 spans/sec |
| Trace query latency (by traceId) | < 50ms |
| Service map query latency (cached) | < 5ms |
| Service map query latency (uncached) | < 500ms |
| LLM analysis time per trace | 5–30s (Ollama on CPU) |
| ClickHouse row count after 24h | > 500,000 spans |

---

## Interview Talking Points This Project Unlocks

- **Why Kafka between Collector and ClickHouse?** — Backpressure. If ClickHouse is slow or down, Kafka retains data. Decouples ingest rate from storage rate.
- **Why ClickHouse over PostgreSQL for traces?** — Columnar storage, `MergeTree` with ordering key on `(ServiceName, StartTime)` makes range scans over time windows 10–100× faster than row-oriented DBs.
- **What does the materialised view buy you?** — Percentile aggregations (p99) are expensive to compute at query time. Materialised view pre-computes them at insert time — dashboard queries are instant.
- **Why OpenTelemetry and not custom logging?** — Vendor-neutral, standard propagation format, auto-instrumentation means zero changes to business logic.
- **How does the AI layer add value?** — Reduces MTTR. Instead of an engineer manually reading 200 spans to find the root cause, the LLM does it in seconds. This is what Datadog AI Insights and New Relic's AI do commercially.
