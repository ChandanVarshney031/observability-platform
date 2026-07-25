FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js otlp-parser.js ./

ENV KAFKA_BROKERS=kafka:9092
ENV CLICKHOUSE_URL=http://clickhouse:8123

CMD ["node", "index.js"]
