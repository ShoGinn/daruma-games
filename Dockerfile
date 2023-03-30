# build image
FROM node:lts-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# production image
FROM node:lts-alpine AS production

RUN apk add --no-cache dumb-init

# Set NODE_ENV to production
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Don't run production as root
RUN \
    chown -R node:node /app \
    && chmod -R 755 /app \
    && mkdir /data \
    && chown -R node:node /data
USER node

VOLUME [ "/data", "/logs" ]

COPY --from=build /app/build ./build

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["npm", "start"]
