FROM node:22-alpine AS base

FROM base AS prune
RUN apk update
RUN apk add --no-cache libc6-compat

RUN npm install -g pnpm

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN mkdir -p $PNPM_HOME
RUN pnpm add -g turbo

COPY . .
RUN turbo prune http-backend --docker

FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm
WORKDIR /app


COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install


FROM base AS installer-production
RUN apk update
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm
WORKDIR /app

ARG DATABASE_NEON_URL
ENV DATABASE_URL=${DATABASE_NEON_URL}

COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --prod --frozen-lockfile

RUN pnpm --filter=db prisma generate


FROM base AS builder
RUN npm install -g pnpm
WORKDIR /app

ARG DATABASE_NEON_URL
ENV DATABASE_URL=${DATABASE_NEON_URL}

COPY --from=installer /app/ .

COPY --from=prune /app/out/full/ .


RUN pnpm --filter=db prisma generate


RUN pnpm turbo build --filter=http-backend

FROM base AS runner
RUN npm install -g pnpm
WORKDIR /app


RUN addgroup --system --gid 1001 web-group
RUN adduser --system --uid 1001 web-user


COPY --from=installer-production --chown=web-user:web-group /app/node_modules /app/node_modules
COPY --from=installer-production --chown=web-user:web-group /app/package.json /app/package.json
COPY --from=installer-production --chown=web-user:web-group /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml


COPY --from=builder --chown=web-user:web-group /app/packages /app/packages


COPY --from=builder --chown=web-user:web-group /app/apps/http-backend /app/apps/http-backend

USER web-user

WORKDIR /app/apps/http-backend

CMD ["sh", "-c", "cd /app/packages/db && npx prisma generate && npx prisma migrate deploy && cd /app/apps/http-backend && pnpm run start"]