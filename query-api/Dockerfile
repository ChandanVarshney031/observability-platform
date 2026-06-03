FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY index.js .

ENV PORT=4000
ENV CLICKHOUSE_URL=http://clickhouse:8123
ENV REDIS_URL=redis://redis:6379

EXPOSE 4000

CMD ["node", "index.js"]
