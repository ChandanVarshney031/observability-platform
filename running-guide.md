# 🚀 How to Run the Observability Platform

## Prerequisites

Install these before you start. Everything is free.

| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | ≥ 24 | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| Docker Compose | ≥ 2.20 (bundled with Docker Desktop) | Comes with Docker Desktop |
| Git | any | [git-scm.com](https://git-scm.com/) |
| Node.js *(dev only)* | ≥ 20 LTS | [nodejs.org](https://nodejs.org/) |
| Python 3.11 *(dev only)* | 3.11 | [python.org](https://www.python.org/) |

> [!IMPORTANT]
> Docker Desktop needs at least **6 GB RAM** assigned. Go to **Settings → Resources → Memory** and set it to 6 GB or more. Ollama (the AI model) needs the extra headroom.

---

## Option A — One-Command Full Stack (Recommended)

This starts every service automatically — databases, Kafka, AI model, microservices, and dashboard.

### Step 1 — Clone and enter the repo

```bash
git clone https://github.com/sanjaysaini383/observability-platform.git
cd observability-platform
```

### Step 2 — Start everything

```bash
cd infra
docker compose up --build
```

> First run takes **5–10 minutes** because Docker pulls images (~3 GB) and Ollama downloads the `llama3` model (~4 GB). Subsequent starts take under 60 seconds.

### Step 3 — Wait for healthy status

Watch the terminal. You'll see these key log lines when everything is ready:

```
✓ Connected to Kafka                   ← kafka-consumer connected
✓ Redis connected                      ← query-api connected
🚀 Query API running on :4000          ← backend is up
✓ OpenTelemetry tracing initialized    ← services sending spans
```

Run this to see which services are healthy:

```bash
docker compose ps
```

All services should show `Up` or `healthy`.

### Step 4 — Open the Dashboard

| URL | What it is |
|-----|-----------|
| **http://localhost:8080** | React Dashboard (Traces, Services, Metrics) |
| http://localhost:4000 | Query REST API |
| http://localhost:3000 | API Gateway (microservice) |
| http://localhost:5000 | Order Service (microservice) |
| http://localhost:3001 | Payment Service (microservice) |
| http://localhost:8123 | ClickHouse HTTP interface |
| http://localhost:11434 | Ollama API |

---

## Step 5 — Generate Live Traffic

The dashboard needs data to show. Run the load generator in a **new terminal**:

```bash
# From the repo root
bash infra/load-gen.sh
```

> On Windows (without Git Bash), open **Git Bash** or **WSL** and run the command there.

You'll see output like:
```
🚀 Load generator started
📍 Target: http://localhost:3000
⏱️  Interval: 2s
📌 GET /order/103
💳 GET /pay/105
📌 GET /order/101
```

After **30–60 seconds** of traffic the dashboard will show live traces, metrics, and service graph data.

---

## Step 6 — Verify Each Layer

### ✅ ClickHouse has data

Open http://localhost:8123/play in your browser (ClickHouse built-in SQL editor) and run:

```sql
SELECT count() FROM traces;
SELECT count() FROM trace_insights;
SELECT ServiceName, count() FROM traces GROUP BY ServiceName;
```

You should see growing row counts after the load generator runs.

### ✅ Kafka is receiving spans

```bash
docker compose exec kafka kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --topic otel.traces \
  --from-beginning \
  --max-messages 5
```

You'll see binary protobuf messages (garbled text is normal — they're compressed).

### ✅ API Gateway is up

```bash
curl http://localhost:4000/health
# → {"status":"healthy","service":"query-api"}

curl http://localhost:4000/api/traces?limit=5
# → {"traces":[...],"count":5}
```

### ✅ AI Insights are being generated

The `trace-analyser` worker runs every **60 seconds**. After an error occurs (the services simulate ~10% error rate automatically), it asks Ollama to explain the root cause:

```bash
curl http://localhost:4000/api/insights
# After ~2 minutes of traffic: {"insights":[{"RootCause":"...","Severity":"high",...}],...}
```

---

## Stopping the Stack

```bash
# In the infra/ directory
docker compose down
```

To also delete all stored data (ClickHouse traces, Ollama model cache):

```bash
docker compose down -v
```

---

## Option B — Run Individual Services for Development

Use this when you're actively developing a specific service.

### Start infrastructure only

```bash
cd infra
docker compose up zookeeper kafka clickhouse redis otel-collector -d
```

### Run `api-gateway` locally

```bash
cd services/api-gateway
npm install
# Set env vars
$env:SERVICE_NAME="api-gateway"
$env:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
$env:ORDER_SERVICE_URL="http://localhost:5000"
$env:PAYMENT_SERVICE_URL="http://localhost:3001"
$env:PORT="3000"
npm start
```

### Run `order-service` locally

```bash
cd services/order-service
pip install -r requirements.txt
$env:SERVICE_NAME="order-service"
$env:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
$env:PORT="5000"
python main.py
```

### Run `payment-service` locally

```bash
cd services/payment-service
npm install
$env:SERVICE_NAME="payment-service"
$env:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
$env:PORT="3001"
npm start
```

### Run `kafka-consumer` locally

```bash
cd kafka-consumer
npm install
$env:KAFKA_BROKERS="localhost:9092"
$env:CLICKHOUSE_URL="http://localhost:8123"
npm start
```

### Run `query-api` locally

```bash
cd query-api
npm install
$env:CLICKHOUSE_URL="http://localhost:8123"
$env:REDIS_URL="redis://localhost:6379"
$env:PORT="4000"
npm start
```

### Run `dashboard` locally (with hot-reload)

```bash
cd dashboard
npm install
$env:REACT_APP_API_URL="http://localhost:4000"
npm run dev
# Opens at http://localhost:3000
```

---

## Troubleshooting

### Dashboard shows "No data" / "Loading..."

1. Check the load generator is running: `bash infra/load-gen.sh`
2. Wait at least 60 seconds for data to flow through Kafka → ClickHouse
3. Check the kafka-consumer logs: `docker compose logs kafka-consumer -f`

### AI Insights sidebar is empty

Ollama needs time to:
1. Start (30–60s)
2. Download `llama3` (~4 GB, first run only — ~10 min)
3. Analyse an error trace (runs every 60s)

Check Ollama's status:
```bash
docker compose logs ollama -f
curl http://localhost:11434/api/tags
# Should return: {"models":[{"name":"llama3",...}]}
```

### ClickHouse tables missing / empty

The init SQL runs once on first startup. If you see errors about missing tables:
```bash
docker compose down -v   # delete volumes
docker compose up --build
```

### Port already in use

Common conflict: Something else is already on port 3000, 4000, or 8123.

Find and kill it (PowerShell):
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

Or change the host port in `infra/docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Change the LEFT side only
```

### Kafka consumer can't connect

Kafka sometimes takes 30–60s to fully initialize. The consumer will retry automatically. If it keeps failing:
```bash
docker compose restart kafka-consumer
```

---

## Service Port Map (Quick Reference)

```
┌─────────────────────────────────────────────────────────┐
│  Your Browser / curl                                    │
│                                                         │
│  http://localhost:8080   → React Dashboard              │
│  http://localhost:4000   → Query API (REST)             │
│  http://localhost:3000   → API Gateway (microservice)   │
│  http://localhost:5000   → Order Service (Python)       │
│  http://localhost:3001   → Payment Service (Node.js)    │
│  http://localhost:8123   → ClickHouse (HTTP)            │
│  http://localhost:11434  → Ollama (AI/LLM)             │
│  localhost:9092          → Kafka (internal)             │
│  localhost:6379          → Redis (internal)             │
│  localhost:4317          → OTel Collector (gRPC)        │
│  localhost:4318          → OTel Collector (HTTP)        │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow (What Happens After `docker compose up`)

```
Load Generator
     │
     │ HTTP requests every 2s
     ▼
API Gateway (port 3000)
     │ calls order-service and payment-service
     │ OTel SDK auto-instruments → emits spans via gRPC
     ▼
OTel Collector (port 4317)
     │ batches spans every 5s
     ▼
Apache Kafka (topic: otel.traces)
     │ persists messages, decouples ingest from storage
     ▼
Kafka Consumer (Node.js)
     │ bulk-inserts rows every 5s or 100 spans
     ▼
ClickHouse (port 8123)
     │ materialised view auto-computes p50/p95/p99 per minute
     │
     ├── Query API (port 4000) ← reads for dashboard
     │        │
     │        └── Redis (cache, 30s TTL for service map)
     │
     └── Trace Analyser (every 60s)
              │ finds error traces not yet in trace_insights
              ▼
           Ollama / llama3 (port 11434)
              │ returns JSON root cause analysis
              ▼
           trace_insights table
              │
              ▼
           Dashboard AI Sidebar (http://localhost:8080)
```
