FROM loadimpact/k6 AS base
WORKDIR /app

FROM node AS build

WORKDIR /src
COPY "package.json" "package.json"
COPY "yarn.lock" "yarn.lock"
RUN yarn install

COPY . .
RUN yarn webpack

FROM base AS final
WORKDIR /app
COPY --from=build /src/dist .
