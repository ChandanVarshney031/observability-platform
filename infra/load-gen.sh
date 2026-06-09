#!/bin/bash

echo "Waiting for services to boot (15s)..."
sleep 15

echo "Initializing databases..."
curl -s -X POST http://localhost:5000/init > /dev/null
curl -s -X POST http://localhost:5001/init > /dev/null
echo "Databases initialized."

echo "Starting E-Commerce Load Generator..."
echo "Press Ctrl+C to stop"

while true; do
  # 1. Simulate user browsing products
  curl -s http://localhost:3000/products > /dev/null
  sleep 1

  # 2. Simulate user checking out
  PRODUCT_ID=$(( ( RANDOM % 4 )  + 1 ))
  QTY=$(( ( RANDOM % 2 )  + 1 ))
  
  curl -s -X POST http://localhost:3000/checkout \
    -H "Content-Type: application/json" \
    -d "{\"items\": [{\"productId\": $PRODUCT_ID, \"qty\": $QTY}]}" > /dev/null
  
  # Random sleep between 1 to 3 seconds
  SLEEP_TIME=$(( ( RANDOM % 3 )  + 1 ))
  echo "Traffic sent (Product: $PRODUCT_ID, Qty: $QTY). Sleeping for ${SLEEP_TIME}s..."
  sleep $SLEEP_TIME
done
