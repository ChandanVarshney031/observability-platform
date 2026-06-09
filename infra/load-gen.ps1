Write-Host "Waiting for services to boot (15s)..."
Start-Sleep -Seconds 15

Write-Host "Initializing databases..."
try { Invoke-WebRequest -Uri "http://localhost:5000/init" -Method POST -UseBasicParsing | Out-Null } catch {}
try { Invoke-WebRequest -Uri "http://localhost:5001/init" -Method POST -UseBasicParsing | Out-Null } catch {}
Write-Host "Databases initialized."

Write-Host "Starting E-Commerce Load Generator..."
Write-Host "Press Ctrl+C to stop"

while ($true) {
    # 1. Simulate user browsing products
    try {
        Invoke-WebRequest -Uri "http://localhost:3000/products" -Method GET -UseBasicParsing | Out-Null
    } catch {}
    
    Start-Sleep -Seconds 1

    # 2. Simulate user checking out
    $PRODUCT_ID = Get-Random -Minimum 1 -Maximum 5
    $QTY = Get-Random -Minimum 1 -Maximum 3
    
    $body = "{`"items`": [{`"productId`": $PRODUCT_ID, `"qty`": $QTY}]}"
    
    try {
        Invoke-WebRequest -Uri "http://localhost:3000/checkout" -Method POST -Headers @{"Content-Type"="application/json"} -Body $body -UseBasicParsing | Out-Null
    } catch {}
    
    # Random sleep between 1 to 3 seconds
    $SLEEP_TIME = Get-Random -Minimum 1 -Maximum 4
    Write-Host "Traffic sent (Product: $PRODUCT_ID, Qty: $QTY). Sleeping for ${SLEEP_TIME}s..."
    Start-Sleep -Seconds $SLEEP_TIME
}
