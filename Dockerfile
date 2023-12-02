# ================= #
#    Base Stage     #
# ================= #

FROM node:lts-alpine AS base

WORKDIR /app

RUN apk add --no-cache dumb-init shadow

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PATH}:${PNPM_HOME}"
RUN npm install --global pnpm

COPY --chown=node:node package*.json .

ENTRYPOINT [ "dumb-init", "--" ]

# ================= #
#   Builder Stage   #
# ================= #

FROM base AS builder

RUN pnpm i

COPY --chown=node:node src/ src/
COPY --chown=node:node tsconfig.* .

RUN pnpm build

# ================= #
#   Runner Stage    #
# ================= #

FROM base AS runner

# Set NODE_ENV to production
ENV NODE_ENV="production"

COPY --chown=node:node --from=builder /app/build ./build

RUN pnpm i --prod

RUN mkdir /data \
  && chown node:node /data

USER node

VOLUME [ "/data" ]

CMD ["node", "build/esm/main.js"]
