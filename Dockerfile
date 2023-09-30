# ================= #
#    Base Stage     #
# ================= #

FROM node:lts-alpine AS base

WORKDIR /app

RUN apk add --no-cache dumb-init shadow

COPY --chown=node:node package*.json .

ENTRYPOINT [ "dumb-init", "--" ]

# ================= #
#   Builder Stage   #
# ================= #

FROM base AS builder

RUN npm ci --no-cache

COPY --chown=node:node src/ src/
COPY --chown=node:node tsconfig.json .

RUN npm run build

# ================= #
#   Runner Stage    #
# ================= #

FROM base AS runner

# Set NODE_ENV to production
ENV NODE_ENV="production"

# Set npm_package_json to /app/package.json
# This is because we are not using NPM and we need to set the path to the package.json
# for the package-json-resolution-engine
ENV npm_package_json=/app/package.json

COPY --chown=node:node --from=builder /app/build ./build

RUN npm ci --omit=dev --no-cache

USER node

RUN mkdir /data \
    && chown node:node /data

VOLUME [ "/data" ]

CMD ["node", "build/esm/main.js"]
