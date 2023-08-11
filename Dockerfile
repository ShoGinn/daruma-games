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

# Set npm_package_json to /app/package.json
# This is because we are not using NPM and we need to set the path to the package.json
# for the package-json-resolution-engine
ENV npm_package_json=/app/package.json

WORKDIR /app

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev --no-cache

# Don't run production as root
ARG UID=1000
ARG GID=1000

COPY --chown=node:node --from=build /app/build ./build

RUN \
    groupmod -g "${GID}" node \
    && usermod -u "${UID}" -g "${GID}" node \
    && mkdir -p /data /logs \
    && chown -R node:node /app /data \
    && chmod -R 755 /app 

USER node

VOLUME [ "/data", "/logs" ]

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "build/esm/main.js"]