FROM node:24-alpine

WORKDIR /app

# Copy dependency configs
COPY apps/server/package*.json ./
RUN npm install

# Copy application files
COPY apps/server/ .

EXPOSE 3001

# Build TypeScript target
RUN npm run build

CMD ["npm", "run", "start"]
