#!/bin/bash

# Load Generator for Observability Platform
# Generates continuous traffic against the API Gateway

API_URL="${API_URL:-http://localhost:3000}"
INTERVAL="${INTERVAL:-2}"  # seconds between requests

ORDER_IDS=(101 102 103 104 105)

echo "🚀 Load generator started"
echo "📍 Target: $API_URL"
echo "⏱️  Interval: ${INTERVAL}s"
echo ""

while true; do
  # Pick a random order ID
  ORDER_ID=${ORDER_IDS[$RANDOM % ${#ORDER_IDS[@]}]}
  
  # Random operation: get order or process payment
  OPERATION=$((RANDOM % 2))
  
  if [ $OPERATION -eq 0 ]; then
    # Get order
    curl -s "$API_URL/order/$ORDER_ID" > /dev/null 2>&1
    echo "📌 GET /order/$ORDER_ID"
  else
    # Process payment
    curl -s "$API_URL/pay/$ORDER_ID?amount=100" > /dev/null 2>&1
    echo "💳 GET /pay/$ORDER_ID"
  fi
  
  sleep $INTERVAL
done
