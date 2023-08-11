# build image
FROM node:lts-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-cache

COPY . .
RUN npm run build

# production image
FROM node:lts-alpine AS production

RUN apk add --no-cache dumb-init shadow

# Set NODE_ENV to production
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-cache

# Don't run production as root
ARG UID=1000
ARG GID=1000

COPY --chown=node:node --from=build /app/build ./build

USER node

VOLUME [ "/data", "/logs" ]

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "build/esm/main.js"]