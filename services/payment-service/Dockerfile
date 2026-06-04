FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY tracing.js app.js ./

ENV SERVICE_NAME=payment-service
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
ENV PORT=3001

EXPOSE 3001

CMD ["node", "--import", "./tracing.js", "app.js"]
