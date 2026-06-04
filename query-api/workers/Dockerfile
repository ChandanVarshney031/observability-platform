FROM node:20-alpine

WORKDIR /app

# Copy package.json from the parent query-api directory
# Build context is query-api/workers/ so we need to go up one level
# We'll handle this by copying the necessary file directly
COPY trace-analyser.js .

# Create a minimal package.json for the worker
RUN echo '{"name":"trace-analyser","version":"1.0.0","type":"module","dependencies":{"axios":"^1.6.2","dotenv":"^16.3.1"}}' > package.json && \
    npm install --production

ENV CLICKHOUSE_URL=http://clickhouse:8123
ENV OLLAMA_URL=http://ollama:11434
ENV MODEL=llama3
ENV ANALYSIS_INTERVAL=60000

CMD ["node", "trace-analyser.js"]
