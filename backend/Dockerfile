FROM node:20-alpine
WORKDIR /app

# Install vips for sharp runtime
RUN apk add --no-cache vips-dev

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV ASSETS_DIR=/app/public
RUN mkdir -p /app/public/assets

EXPOSE 5000
CMD ["node", "index.js"]
