# 🕵️ Distributed Tracing & Observability Platform

A **production-ready** distributed tracing and observability platform with AI-powered root cause analysis. Built entirely with free/open-source technologies — OpenTelemetry, Kafka, ClickHouse, Groq AI, and React.

> **Zero paid APIs. Zero proprietary SaaS. One `docker compose up`.**

---

## 🎯 Quick Start (5 minutes)

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | ≥ 24 | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| Git | any | [git-scm.com](https://git-scm.com/) |

> ⚠️ **Docker Desktop needs at least 6 GB RAM.** Go to **Settings → Resources → Memory** and set to 6 GB+.

### Step 1 — Clone

```bash
git clone https://github.com/sanjaysaini383/observability-platform.git
cd observability-platform
```

### Step 2 — Add your Groq API key

Create the file `infra/.env` (already gitignored):

```bash
# Get your FREE key at: https://console.groq.com → API Keys → Create key
echo "GROQ_API_KEY=gsk_your_key_here" > infra/.env
```

> Groq is completely free, needs zero local disk space, and gives fast llama3 inference in the cloud.

### Step 3 — Start the entire stack

```bash
cd infra
docker compose up --build
```

First run pulls Docker images (~2 GB). Subsequent starts take under 60 seconds.

### Step 4 — Generate live traffic

Open a **new terminal** (use Git Bash or WSL on Windows):

```bash
bash infra/load-gen.sh
```

### Step 5 — Open the dashboard

| URL | What it is |
|-----|-----------|
| **http://localhost:8080** | 🖥️ React Dashboard |
| http://localhost:4000 | 🔌 Query REST API |
| http://localhost:3000 | 🚪 API Gateway |
| http://localhost:8123 | 🗄️ ClickHouse HTTP |

After ~60s of traffic: traces appear. After ~2 min: AI insights appear in the sidebar.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INSTRUMENTED MICROSERVICES                      │
│   api-gateway (Node.js)  │  order-service (Python)  │  payment (Node.js) │
│   OTel SDK auto-instruments HTTP calls, emits spans via gRPC       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ OTLP/gRPC
                               ▼
                    ┌──────────────────────┐
                    │  OTel Collector       │  ← batches + memory limits
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        otel.traces      otel.metrics       otel.logs
              └────────────────┼────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │   Apache Kafka        │  ← backpressure buffer
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Kafka Consumer      │  ← protobuf → ClickHouse
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   ClickHouse (OLAP)   │  ← columnar storage
                    │   + Materialised View │     p50/p95/p99 per minute
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                                 ▼
   ┌──────────────────────┐       ┌─────────────────────────┐
   │  Trace Analyser       │       │  Query API (Express)     │
   │  (background worker)  │       │  + Redis cache (30s TTL) │
   │  polls error traces   │       └──────────┬──────────────┘
   │  every 60 seconds     │                  │
   └──────────┬────────────┘                  ▼
              │ HTTP                ┌──────────────────────┐
              ▼                    │  React Dashboard      │
   ┌──────────────────────┐        │  • Trace Explorer     │
   │  Groq Cloud API       │        │  • Service Graph      │
   │  llama3-8b-8192       │        │  • Metrics + Alerts   │
   │  (free tier)          │        │  • AI Insights Sidebar│
   └──────────┬────────────┘        └──────────────────────┘
              │ saves insight
              ▼
   trace_insights table (ClickHouse)
```

### Data Flow Summary

```
Load Generator
  → API Gateway (port 3000)
    → order-service (port 5000) + payment-service (port 3001)
      → OTel spans → Collector (port 4317)
        → Kafka (3 topics)
          → Kafka Consumer → ClickHouse
            → Query API (port 4000) → Redis cache
              → React Dashboard (port 8080)
            → Trace Analyser → Groq API → trace_insights → Dashboard AI Sidebar
```

---

## 📦 Project Structure

```
observability-platform/
├── services/
│   ├── api-gateway/          # Node.js + Express — public API, calls other services
│   │   ├── tracing.js        # OTel SDK (loaded via --import flag)
│   │   └── app.js            # Routes: GET /order/:id, GET /pay/:orderId
│   ├── order-service/        # Python FastAPI — returns fake orders, 5% error rate
│   │   ├── tracing.py        # OTel SDK for Python
│   │   └── main.py           # FastAPI app
│   └── payment-service/      # Node.js + Express — payment sim, 8% timeout rate
│       ├── tracing.js
│       └── app.js
│
├── collector/
│   └── otelcol-config.yaml   # OTel Collector: OTLP → Kafka (traces/metrics/logs)
│
├── kafka-consumer/
│   └── index.js              # Reads Kafka topics → bulk-inserts into ClickHouse
│
├── query-api/
│   ├── index.js              # REST API: /api/traces, /api/services, /api/metrics,
│   │                         #           /api/alerts, /api/insights, /api/insights/:id
│   └── workers/
│       └── trace-analyser.js # Background worker: error traces → Groq → trace_insights
│
├── dashboard/
│   └── src/
│       ├── App.js            # Router + layout (Navbar + AI sidebar)
│       ├── pages/
│       │   ├── TraceExplorer.js   # Trace list + waterfall detail panel
│       │   ├── ServiceGraph.js    # react-flow dependency graph (dagre layout)
│       │   └── MetricsView.js     # Recharts latency/error-rate + alerts
│       └── components/
│           ├── Navbar.js
│           └── AIInsightsSidebar.js  # Right panel, polls /api/insights every 15s
│
└── infra/
    ├── docker-compose.yml    # Full stack — 10 services
    ├── .env                  # YOUR GROQ_API_KEY goes here (gitignored)
    ├── .env.example          # Template — safe to commit
    ├── load-gen.sh           # Continuous traffic generator
    └── clickhouse/
        └── init.sql          # Schema DDL + materialised views + helper views
```

---

## 🔧 Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Instrumentation** | OpenTelemetry SDK (Node.js + Python) | Industry standard, vendor-neutral, auto-instruments HTTP |
| **Collection** | OTel Collector Contrib 0.92 | Batch + memory-limit + Kafka export |
| **Message Broker** | Apache Kafka (Confluent 7.5) | Decouples ingest from storage, survives ClickHouse downtime |
| **Storage** | ClickHouse 24.3 | Columnar OLAP — 10-100× faster than Postgres for trace queries |
| **Cache** | Redis 7 | Sub-millisecond service map lookups |
| **Query API** | Node.js + Express | REST over ClickHouse + Redis |
| **AI / LLM** | Groq cloud API (llama3-8b-8192) | Free tier, zero disk space, ~2s inference |
| **Frontend** | React 18 + Tailwind CSS | Dark-mode UI |
| **Charts** | Recharts 2.10 | Composable React charts |
| **Graph** | react-flow 11 + dagre | Auto-layout service dependency graph |
| **Containerisation** | Docker + Docker Compose | One-command full stack |

---

## 📊 Benchmark Targets

After running `load-gen.sh` for 5+ minutes:

| Metric | Target |
|--------|--------|
| Spans ingested/sec | > 500 |
| Trace query by traceId | < 50ms |
| Service map query (cached) | < 5ms |
| Service map query (uncached) | < 500ms |
| AI root cause analysis (Groq) | ~2s per trace |
| ClickHouse rows after 24h | > 500,000 |
| Dashboard refresh latency | < 1s |

---

## 📚 API Reference

### Traces

```bash
# List recent traces (filter by service, status, time)
curl "http://localhost:4000/api/traces?service=api-gateway&status=error&limit=50"

# Full span list for a trace
curl "http://localhost:4000/api/traces/abc123def456"
```

### Metrics

```bash
# Latency percentiles + error rate (window: 1h, 6h, 24h)
curl "http://localhost:4000/api/metrics?service=payment-service&window=1h"

# Active anomaly alerts
curl "http://localhost:4000/api/alerts"
```

### Service Graph

```bash
# Nodes + edges for service dependency graph (Redis cached 30s)
curl "http://localhost:4000/api/services"
```

### AI Insights

```bash
# 10 most recent LLM root cause analyses (for sidebar)
curl "http://localhost:4000/api/insights"

# Root cause for a specific trace
curl "http://localhost:4000/api/insights/abc123def456"
```

---

## 🛠️ Local Development (without full Docker stack)

Start only the infrastructure via Docker:

```bash
cd infra
docker compose up zookeeper kafka clickhouse redis otel-collector -d
```

Then run each service locally:

```bash
# api-gateway
cd services/api-gateway && npm install
$env:SERVICE_NAME="api-gateway"; $env:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
$env:ORDER_SERVICE_URL="http://localhost:5000"; $env:PAYMENT_SERVICE_URL="http://localhost:3001"
npm start   # → http://localhost:3000

# order-service
cd services/order-service && pip install -r requirements.txt
$env:SERVICE_NAME="order-service"; $env:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
python main.py   # → http://localhost:5000

# payment-service
cd services/payment-service && npm install
$env:SERVICE_NAME="payment-service"; $env:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
npm start   # → http://localhost:3001

# kafka-consumer
cd kafka-consumer && npm install
$env:KAFKA_BROKERS="localhost:9092"; $env:CLICKHOUSE_URL="http://localhost:8123"
npm start

# query-api
cd query-api && npm install
$env:CLICKHOUSE_URL="http://localhost:8123"; $env:REDIS_URL="redis://localhost:6379"
npm start   # → http://localhost:4000

# trace-analyser (set your Groq key first)
cd query-api/workers
$env:LLM_PROVIDER="groq"; $env:GROQ_API_KEY="gsk_xxx"; $env:CLICKHOUSE_URL="http://localhost:8123"
node trace-analyser.js

# dashboard (hot reload)
cd dashboard && npm install
$env:REACT_APP_API_URL="http://localhost:4000"
npm run dev   # → http://localhost:3000
```

---

## 🤖 LLM Provider Options

The trace analyser supports three providers — switch via `LLM_PROVIDER` in `infra/.env`:

| Provider | Disk | Internet | Setup |
|----------|------|----------|-------|
| `groq` *(default)* | 0 MB | ✅ | Add `GROQ_API_KEY` to `infra/.env` |
| `ollama` (local tiny) | ~600 MB | ❌ | Change `MODEL: tinyllama` in compose |
| `mock` (no LLM) | 0 MB | ❌ | Set `LLM_PROVIDER=mock` — fake analysis, great for dev |

**Groq `.env` config:**
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxx
```

**Mock `.env` config (no key needed):**
```env
GROQ_API_KEY=unused
```
And in `docker-compose.yml` set `LLM_PROVIDER: mock`.

---

## 📝 Troubleshooting

### Dashboard shows no data
1. Make sure `load-gen.sh` is running
2. Wait 60s for data to flow through Kafka → ClickHouse
3. Check kafka-consumer: `docker compose logs kafka-consumer -f`

### AI Insights sidebar is empty
- Groq analyser runs every 60s — wait 2 minutes
- Verify API key: `docker compose logs trace-analyser -f`
- Test: `curl http://localhost:4000/api/insights`

### ClickHouse tables don't exist
```bash
docker compose down -v   # wipes volumes
docker compose up --build
```

### Port already in use
Change the **left** side of the port mapping in `docker-compose.yml`:
```yaml
ports:
  - "8081:3000"  # change 8080 → 8081, keep :3000
```

### Kafka consumer not connecting
```bash
docker compose restart kafka-consumer
```
Kafka takes 30–60s to fully initialise on first boot.

### Viewing logs
```bash
docker compose logs -f trace-analyser    # AI worker
docker compose logs -f kafka-consumer    # ingestion pipeline
docker compose logs -f query-api         # REST API
docker compose logs -f otel-collector    # span collection
```

---

## 💡 Interview Talking Points

### Why Kafka between Collector and ClickHouse?
> **Backpressure.** If ClickHouse is slow or down, Kafka retains data and the consumer catches up on restart. This decouples ingest rate from storage rate — a core resilience pattern.

### Why ClickHouse over PostgreSQL for traces?
> **Columnar storage.** The `ORDER BY (ServiceName, StartTime)` key makes time-range scans over millions of rows 10–100× faster than row-oriented databases. `MergeTree` compresses repetitive values aggressively.

### What does the materialised view buy you?
> **Pre-computed aggregations.** p99 percentiles are expensive at query time. `service_latency_mv` computes them at insert time — dashboard queries return instant results.

### Why OpenTelemetry and not custom logging?
> **Vendor-neutral + auto-instrumentation.** Zero changes to business logic. Standard `traceparent` header propagation links spans across service boundaries automatically.

### How does the AI layer add value?
> **Reduces MTTR.** Instead of an engineer reading 200 spans to find the root cause, the Groq-hosted llama3 model does it in ~2 seconds. This is exactly what Datadog AI Insights and New Relic's AI feature do commercially.

---

## 🔐 Security Notes

**Current (Development)**
- All services on the same Docker bridge network
- No authentication on Query API
- Groq API key stored in local `.env` (gitignored)

**Production Checklist**
- [ ] Add API key / JWT authentication to Query API
- [ ] Enable TLS between services
- [ ] Add Redis password
- [ ] Set ClickHouse username/password
- [ ] Store Groq key in a secrets manager (AWS Secrets Manager, Vault)
- [ ] Enable rate limiting on API endpoints

---

## 🎓 Portfolio Impact

This project demonstrates:
- ✅ **Full-stack distributed systems** — frontend → pipeline → OLAP storage
- ✅ **Production architecture** — Kafka buffering, columnar storage, LLM integration
- ✅ **OpenTelemetry best practices** — auto-instrumentation, context propagation
- ✅ **Real-time streaming** — Kafka + ClickHouse materialised views
- ✅ **AI in production infrastructure** — LLM root cause analysis
- ✅ **DevOps** — Docker, health checks, graceful shutdown, retry logic

> This is the architecture **Datadog, New Relic, and Honeycomb** use. You've built a working version from scratch. 🎉

---

## 📖 Further Reading

- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [ClickHouse Documentation](https://clickhouse.com/docs/)
- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [Groq API Docs](https://console.groq.com/docs)
- [React Flow](https://reactflow.dev/)

---

## 📄 License

MIT — use freely for learning, portfolios, or production.

---

**Happy tracing! 🕵️**

Built with ❤️ using OpenTelemetry · Kafka · ClickHouse · Groq · React
