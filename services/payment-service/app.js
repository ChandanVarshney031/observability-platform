// Must import tracing FIRST
import './tracing.js';

import express from 'express';
import { trace } from '@opentelemetry/api';

const app = express();
const port = process.env.PORT || 3001;
const tracer = trace.getTracer('payment-service');

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'payment-service' });
});

/**
 * POST /pay
 * Process payment
 * Simulates: 100-400ms gateway delay, 8% timeout rate
 */
app.post('/pay', async (req, res) => {
  const span = tracer.startSpan('process_payment');

  try {
    const { orderId, amount } = req.body;

    if (!orderId || !amount) {
      span.recordException(new Error('Missing orderId or amount'));
      span.setStatus({ code: 2 }); // ERROR
      return res.status(400).json({
        error: 'Missing orderId or amount',
      });
    }

    span.setAttributes({
      'payment.order_id': orderId,
      'payment.amount': amount,
    });

    // Simulate payment gateway delay (100-400ms)
    const delay = Math.random() * 300 + 100;
    span.addEvent('payment_gateway_call_start', {
      'delay_ms': delay,
    });

    await new Promise((resolve) => setTimeout(resolve, delay));

    // Simulate 8% timeout/failure rate
    if (Math.random() < 0.08) {
      const error = new Error('Payment gateway timeout - simulated');
      span.recordException(error);
      span.setStatus({ code: 2 }); // ERROR
      span.end();
      return res.status(504).json({
        error: 'Payment service timeout',
      });
    }

    // Simulate occasional errors
    if (Math.random() < 0.03) {
      const error = new Error('Insufficient funds - simulated');
      span.recordException(error);
      span.setStatus({ code: 2 }); // ERROR
      span.end();
      return res.status(402).json({
        error: 'Insufficient funds',
      });
    }

    span.addEvent('payment_gateway_call_end', {
      'status': 'success',
    });

    span.setStatus({ code: 0 }); // OK
    span.end();

    res.json({
      success: true,
      transactionId: `TXN-${Date.now()}`,
      orderId,
      amount,
      status: 'completed',
      timestamp: new Date().toISOString(),
      service: 'payment-service',
    });
  } catch (error) {
    console.error('Error processing payment:', error.message);
    span.recordException(error);
    span.setStatus({ code: 2 }); // ERROR
    span.end();
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /transactions/:transactionId
 * Fetch transaction status
 */
app.get('/transactions/:transactionId', async (req, res) => {
  const span = tracer.startSpan('fetch_transaction');

  try {
    const { transactionId } = req.params;

    span.setAttributes({
      'transaction.id': transactionId,
    });

    // Simulate DB lookup with 20-100ms delay
    const delay = Math.random() * 80 + 20;
    await new Promise((resolve) => setTimeout(resolve, delay));

    span.setStatus({ code: 0 }); // OK
    span.end();

    res.json({
      transactionId,
      status: 'completed',
      amount: 100,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching transaction:', error.message);
    span.recordException(error);
    span.setStatus({ code: 2 }); // ERROR
    span.end();
    res.status(500).json({
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Payment Service running on http://localhost:${port}`);
  console.log(`📊 OTel Collector: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317'}`);
});
