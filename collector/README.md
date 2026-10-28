# OpenTelemetry Collector & Tail-Based Sampling

This directory contains the OpenTelemetry Collector configuration (`otelcol-config.yaml`) for the observability platform.

## Overview: Why Tail-Based Sampling?

In distributed systems, storing 100% of telemetry traces generates massive storage and network overhead. In typical production environments, **>95% of traces are healthy, fast, and repetitive** (e.g. routine health checks or fast product page loads), while the most critical traces for debugging—**errors, exceptions, and latency outliers**—represent only a small fraction of overall volume.

### Head-Based vs. Tail-Based Sampling

| Metric | Head-Based Sampling | Tail-Based Sampling (TraceLens) |
| :--- | :--- | :--- |
| **Decision Point** | At root span generation (before request finishes) | At the tail of the trace (after all spans finish) |
| **Context Aware?** | No — cannot know in advance if request will fail or lag | Yes — evaluates complete trace duration and status codes |
| **Error Retention** | Drops errors proportional to sampling rate | **100% retention** of all errored traces |
| **Slow Trace Retention** | Drops slow traces proportional to sampling rate | **100% retention** of latency outliers |
| **Storage Reduction** | Coarse reduction with data loss on errors | **10x–20x reduction** with zero loss on critical diagnostic data |

---

## Sampling Policies

The collector evaluates incoming traces against three sequential policies in the `tail_sampling` processor. When any policy evaluates to `true` (sampled), the entire trace is retained and exported:

```
                          ┌───────────────────────────┐
                          │    Incoming OTLP Spans    │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │      memory_limiter       │ (Drops/GCs if RAM > 256 MiB)
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │   tail_sampling Buffer    │ (Hold for decision_wait: 10s)
                          └─────────────┬─────────────┘
                                        │
            ┌───────────────────────────┼───────────────────────────┐
            │                           │                           │
            ▼                           ▼                           ▼
┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
│  error-traces-policy  │   │   slow-traces-policy  │   │  healthy-probabilistic│
│ (Any span StatusCode  │   │ (Trace latency >=     │   │ (Sample % of healthy  │
│  == 2 / ERROR)        │   │  threshold_ms)        │   │  fast traces)         │
└───────────┬───────────┘   └───────────┬───────────┘   └───────────┬───────────┘
            │                           │                           │
            └───────────────────────────┼───────────────────────────┘
                                        │ (Any Match = KEEP)
                                        ▼
                          ┌───────────────────────────┐
                          │      batch Processor      │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │       Kafka Export        │
                          └───────────────────────────┘
```

### 1. `error-traces-policy` (Status Code Policy)
* **Rule:** Retains 100% of traces where any span contains OpenTelemetry `StatusCode == 2` (`STATUS_CODE_ERROR` / `ERROR`).
* **Purpose:** Ensures root cause analysis, error stack traces, and uncaught exceptions are never lost. Essential for the AI Trace Analyzer worker to diagnose failures.

### 2. `slow-traces-policy` (Latency Policy)
* **Rule:** Retains 100% of traces whose overall duration (from earliest span start to latest span end) is greater than or equal to `TRACE_LATENCY_THRESHOLD_MS` (default: `500ms`).
* **Purpose:** Catches slow database queries, upstream network timeouts, and p95/p99 performance degradation even when requests technically return HTTP 200 OK.

### 3. `healthy-traces-probabilistic-policy` (Probabilistic Policy)
* **Rule:** Deterministically samples a configurable percentage (`TRACE_SAMPLE_PERCENTAGE`, default: `10%`) of remaining healthy, fast traces using an FNV-1a hash of the `trace_id`.
* **Purpose:** Retains a statistically valid baseline of healthy traces for service topology mapping and throughput analysis without paying the storage cost for 100% of repetitive healthy spans.

---

## Memory & Latency Costs of Buffering Spans

Because tail-based sampling must inspect the entire trace before making a decision, spans must be held in memory for a configurable time window (`decision_wait`). This introduces both memory and latency implications:

### 1. Memory Cost

The tail sampling processor maintains an in-memory trace buffer. The memory required scales with incoming traffic volume, span depth, and the `decision_wait` duration:

$$\text{Memory Required} \approx \text{Throughput (traces/sec)} \times \text{Avg spans per trace} \times \text{Avg span size (bytes)} \times \text{decision\_wait (seconds)}$$

#### Practical Sizing Examples:

| Ingestion Rate | Spans / Trace | Avg Span Size | decision_wait | In-Memory Working Set |
| :--- | :--- | :--- | :--- | :--- |
| **50 traces/s** (Dev/Local) | 5 spans | 2 KB | 10s | **~5 MB** |
| **200 traces/s** (Moderate Load) | 6 spans | 2 KB | 10s | **~24 MB** |
| **1,000 traces/s** (High Throughput) | 8 spans | 2 KB | 10s | **~160 MB** |
| **2,500 traces/s** (Spike) | 8 spans | 2 KB | 10s | **~400 MB** |

#### Why `memory_limiter` Settings Still Hold:
* In `otelcol-config.yaml`, the `memory_limiter` processor is placed **strictly first** in the pipeline before `tail_sampling`:
  ```yaml
  processors: [memory_limiter, tail_sampling, batch, resource]
  ```
* **Settings:**
  * `check_interval: 5s`
  * `limit_mib: 256`
  * `spike_limit_mib: 128`
* If a sudden traffic surge threatens to exceed 256 MiB, the `memory_limiter` immediately forces Go garbage collection (`GOGC: 80`) and drops incoming data before the collector process can crash from an Out-Of-Memory (OOM) kill.

### 2. Latency Cost

* **Pipeline Ingestion Delay:** Spans are held in the collector for `decision_wait` (10 seconds) before being pushed downstream to Kafka and ClickHouse.
* **No Application Runtime Impact:** The sampling wait occurs entirely asynchronously inside the Collector. Application response times (API Gateway, Order Service, Payment Service) are **completely unaffected (0ms added user latency)**.
* **Tuning `decision_wait`:**
  * **Too short (<3s):** Spans from multi-step asynchronous or slow downstream services may arrive after the decision is already rendered, causing incomplete traces.
  * **Too long (>30s):** Increases memory consumption proportionally and introduces noticeable lag before live traces appear on the dashboard.
  * **10s Default:** The ideal balance for distributed microservices with typical round-trip times <2s.

---

## Configuration & Environment Variables

The tail sampling parameters can be adjusted dynamically via environment variables in `infra/.env`:

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `TRACE_SAMPLE_PERCENTAGE` | Percentage of healthy, fast traces to retain | `10` (10% retained, 90% dropped) | `5` (for 20x storage reduction) |
| `TRACE_LATENCY_THRESHOLD_MS` | Latency threshold in ms for 100% slow trace retention | `500` | `250` (catch sub-300ms delays) |

### Docker Compose Integration

In `infra/docker-compose.yml`, these environment variables are passed directly to the `otel-collector` container:

```yaml
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.92.0
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ../collector/otelcol-config.yaml:/etc/otel-collector-config.yaml
    environment:
      GOGC: 80
      TRACE_SAMPLE_PERCENTAGE: ${TRACE_SAMPLE_PERCENTAGE:-10}
      TRACE_LATENCY_THRESHOLD_MS: ${TRACE_LATENCY_THRESHOLD_MS:-500}
```

---

## Horizontal Scaling Consideration: Trace Routing

When running multiple collector instances in a Kubernetes or clustered environment:
* Spans belonging to the same `trace_id` **must** land on the same Collector instance so the tail sampler can evaluate the complete trace.
* In multi-replica setups, place an OTel Gateway tier upstream using the `loadbalancing` exporter routing by `routing_key: trace_id`.
