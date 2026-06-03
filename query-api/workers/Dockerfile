FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY workers/trace-analyser.js .
COPY .env.example .env

ENV CLICKHOUSE_URL=http://clickhouse:8123
ENV OLLAMA_URL=http://ollama:11434
ENV MODEL=llama3

CMD ["node", "trace-analyser.js"]
