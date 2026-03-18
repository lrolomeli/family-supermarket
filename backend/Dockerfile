FROM node:20-alpine
WORKDIR /app

# Install vips for sharp (prebuilt binary support)
RUN apk add --no-cache vips-dev

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts && \
    npm rebuild sharp

COPY . .

ENV ASSETS_DIR=/app/public
RUN mkdir -p /app/public/assets

EXPOSE 5000
CMD ["node", "index.js"]
