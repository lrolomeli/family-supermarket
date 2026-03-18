FROM node:20-alpine
WORKDIR /app

# Install sharp dependencies for alpine
RUN apk add --no-cache vips-dev

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

# Assets directory will be mounted or set via ASSETS_DIR env
ENV ASSETS_DIR=/app/public
RUN mkdir -p /app/public/assets

EXPOSE 5000
CMD ["node", "index.js"]
