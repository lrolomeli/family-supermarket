FROM node:20-alpine
WORKDIR /app

# Install build dependencies for sharp
RUN apk add --no-cache vips-dev build-base python3

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY . .

ENV ASSETS_DIR=/app/public
RUN mkdir -p /app/public/assets

EXPOSE 5000
CMD ["node", "index.js"]
