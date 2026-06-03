FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY index.js .

ENV KAFKA_BROKERS=kafka:9092
ENV CLICKHOUSE_URL=http://clickhouse:8123

CMD ["node", "index.js"]
