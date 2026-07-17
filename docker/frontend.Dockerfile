FROM node:24-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy dependency configs
COPY apps/web/package*.json ./
RUN npm install

# Copy application files
COPY apps/web/ .

ENV PORT 3000
EXPOSE 3000

RUN npm run build

CMD ["npm", "run", "start"]
