import os
import logging
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry import trace

# Get environment variables
otel_endpoint = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4317')
service_name = os.getenv('SERVICE_NAME', 'order-service')
environment = os.getenv('OTEL_RESOURCE_ATTRIBUTES', 'deployment.environment=dev')

# Create TracerProvider
resource = Resource.create({
    SERVICE_NAME: service_name,
    "deployment.environment": environment.split('=')[1] if '=' in environment else 'dev',
})

tracer_provider = TracerProvider(resource=resource)

# Create and add BatchSpanProcessor with OTLP exporter
otlp_exporter = OTLPSpanExporter(
    endpoint=otel_endpoint,
    insecure=True,
)
tracer_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

# Set the global tracer provider
trace.set_tracer_provider(tracer_provider)

# Instrument FastAPI and HTTPx
FastAPIInstrumentor.instrument()
HTTPXClientInstrumentor.instrument()

logging.info(f"✓ OpenTelemetry tracing initialized for {service_name}")
logging.info(f"✓ Endpoint: {otel_endpoint}")
