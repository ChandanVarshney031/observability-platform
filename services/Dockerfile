FROM node:18-alpine

WORKDIR /app

# Copy the shared package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy all service code
COPY . .

# Default command (will be overridden by docker-compose)
CMD ["node", "api-gateway/app.js"]
