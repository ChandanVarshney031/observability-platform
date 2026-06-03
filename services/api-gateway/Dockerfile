FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY tracing.js app.js ./

ENV SERVICE_NAME=api-gateway
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
ENV PORT=3000

EXPOSE 3000

CMD ["node", "app.js"]
