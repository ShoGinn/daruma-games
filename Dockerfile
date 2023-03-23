# build image
FROM node:lts-alpine AS build

USER node

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

USER node

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=build /app/build ./build

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "build/esm/main.js"]
