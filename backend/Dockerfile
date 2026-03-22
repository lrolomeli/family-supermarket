FROM node:20-alpine
WORKDIR /app

# Runtime lib for sharp
RUN apk add --no-cache vips

COPY package.json ./
# Install deps without running postinstall scripts
RUN npm install --omit=dev --ignore-scripts
# Force sharp to download the correct prebuilt binary for linux/musl
RUN npm install --os=linux --cpu=$(node -p "process.arch") --libc=musl sharp

COPY . .

ENV ASSETS_DIR=/app/public
RUN mkdir -p /app/public/images

EXPOSE 5000
CMD ["node", "index.js"]
