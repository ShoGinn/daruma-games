# build image
FROM node:lts-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# production image
FROM node:lts-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=build /app/build ./build

# Set NODE_ENV to production
ENV NODE_ENV=production

CMD ["npm", "start"]
