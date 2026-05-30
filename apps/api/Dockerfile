FROM node:22-bookworm-slim AS builder
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN npm ci
RUN npm run build -w packages/types
RUN npm run build -w packages/crypto
RUN npm run prisma:generate -w apps/api
RUN npm run build -w apps/api

FROM node:22-bookworm-slim AS runner
WORKDIR /workspace
ENV NODE_ENV=production
ENV NODE_OPTIONS=--experimental-sqlite

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    poppler-utils \
    openssl \
    python3 \
    python3-opencv \
    python3-numpy \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/package.json /workspace/package-lock.json ./
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/packages ./packages
COPY --from=builder /workspace/apps/api ./apps/api

WORKDIR /workspace/apps/api
CMD ["npm", "run", "start:cloud"]
