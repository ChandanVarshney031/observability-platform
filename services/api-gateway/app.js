// Must import tracing FIRST, before any other code
import './tracing.js';

import express from 'express';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3000;

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:5000';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3001';

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-gateway' });
});

/**
 * GET /order/:id
 * Calls order-service and returns order details
 * Simulates: 50-300ms processing delay, 10% error rate
 */
app.get('/order/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Simulate processing delay
    const delay = Math.random() * 250 + 50;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Simulate 10% error rate
    if (Math.random() < 0.1) {
      return res.status(500).json({
        error: 'Failed to fetch order - simulated error',
        traceId: req.headers['traceparent'],
      });
    }

    // Call order-service
    const response = await axios.get(`${ORDER_SERVICE_URL}/order/${id}`, {
      timeout: 5000,
      headers: {
        'traceparent': req.headers['traceparent'] || '',
      },
    });

    res.json({
      order: response.data,
      gateway_processed: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching order:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.message,
      service: 'api-gateway',
    });
  }
});

/**
 * GET /pay/:orderId
 * Calls payment-service to process payment
 * Simulates: 100-400ms delay, 8% timeout rate
 */
app.get('/pay/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const amount = req.query.amount || 100;

    // Simulate 8% timeout
    if (Math.random() < 0.08) {
      return res.status(504).json({
        error: 'Payment service timeout - simulated',
      });
    }

    // Call payment-service
    const response = await axios.post(
      `${PAYMENT_SERVICE_URL}/pay`,
      {
        orderId,
        amount,
      },
      {
        timeout: 5000,
        headers: {
          'traceparent': req.headers['traceparent'] || '',
        },
      }
    );

    res.json({
      payment: response.data,
      gateway_processed: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing payment:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.message,
      service: 'api-gateway',
    });
  }
});

/**
 * GET /trace-test
 * Calls both order and payment services in sequence
 */
app.get('/trace-test/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Fetch order
    const orderRes = await axios.get(`${ORDER_SERVICE_URL}/order/${orderId}`, {
      timeout: 5000,
    });

    // Process payment
    const paymentRes = await axios.post(
      `${PAYMENT_SERVICE_URL}/pay`,
      {
        orderId,
        amount: 100,
      },
      { timeout: 5000 }
    );

    res.json({
      order: orderRes.data,
      payment: paymentRes.data,
      trace_complete: true,
    });
  } catch (error) {
    console.error('Error in trace test:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 API Gateway running on http://localhost:${port}`);
  console.log(`📊 OTel Collector: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317'}`);
});
