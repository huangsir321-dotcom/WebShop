# syntax=docker/dockerfile:1
#
# FORME storefront + API image.
#
# Used by `docker compose up` locally and by the one-click deploy targets
# (Render, Railway, Fly). The API serves the static storefront too, so one
# container is the whole site.

FROM node:22-bookworm-slim

# Prisma's query engine needs OpenSSL and the CA certificates.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The manifest and the Prisma schema come first: `npm ci` runs the
# @prisma/client postinstall, which generates the client from the schema.
COPY package*.json ./
COPY server/prisma ./server/prisma
RUN npm ci --include=dev

COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
# The platform injects PORT; the API reads it from the environment.
ENV PORT=4000
EXPOSE 4000

# `start:prod` applies the schema to the database before booting, so a fresh
# database is usable on the very first start.
CMD ["npm", "run", "start:prod"]
