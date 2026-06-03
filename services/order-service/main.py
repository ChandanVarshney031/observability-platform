# Must import tracing FIRST, before app creation
import tracing  # noqa: F401

import os
import asyncio
import random
import logging
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from opentelemetry import trace

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Order Service", version="1.0.0")
tracer = trace.get_tracer(__name__)

# Sample order data
ORDERS = {
    "101": {"id": "101", "customer": "Alice", "total": 150.00, "status": "pending"},
    "102": {"id": "102", "customer": "Bob", "total": 250.00, "status": "completed"},
    "103": {"id": "103", "customer": "Charlie", "total": 75.50, "status": "pending"},
    "104": {"id": "104", "customer": "Diana", "total": 300.00, "status": "shipped"},
    "105": {"id": "105", "customer": "Eve", "total": 125.00, "status": "pending"},
}


@app.get("/health")
async def health():
    return JSONResponse({"status": "healthy", "service": "order-service"})


@app.get("/order/{order_id}")
async def get_order(order_id: str):
    """
    Fetch order by ID
    Simulates: 20-150ms DB query delay, 5% error rate
    """
    try:
        with tracer.start_as_current_span("db_query") as span:
            span.set_attribute("order.id", order_id)

            # Simulate DB query delay (20-150ms)
            delay = random.uniform(0.02, 0.15)
            await asyncio.sleep(delay)
            span.set_attribute("db.duration_ms", delay * 1000)

            # Simulate 5% error rate
            if random.random() < 0.05:
                raise HTTPException(
                    status_code=500,
                    detail="Database error - simulated error",
                )

            # Get order from cache
            order = ORDERS.get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            span.set_attribute("order.found", True)
            span.set_attribute("order.status", order.get("status"))

            logger.info(f"Order {order_id} fetched successfully")

            return {
                "success": True,
                "order": order,
                "service": "order-service",
                "timestamp": asyncio.get_event_loop().time(),
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching order {order_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 5000))
    print(f"🚀 Order Service running on http://localhost:{port}")
    print(
        f"📊 OTel Collector: {os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4317')}"
    )

    uvicorn.run(app, host="0.0.0.0", port=port)
