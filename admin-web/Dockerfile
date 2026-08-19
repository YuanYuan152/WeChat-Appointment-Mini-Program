# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim@sha256:f32b81066cde10a75dbac96646099533316d94bac4150c55da1636e1f0ffdc46 AS dependencies

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

ARG APP_VERSION=unknown
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_EAP_BASE_URL
ARG NEXT_PUBLIC_ACCESS_KEY_LOGIN_ENABLED=false
ARG NEXT_PUBLIC_ACCESS_KEY=
ARG NEXT_PUBLIC_ACCESS_KEY_LOGIN_CODE=dev_admin

ENV APP_VERSION=${APP_VERSION} \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_EAP_BASE_URL=${NEXT_PUBLIC_EAP_BASE_URL} \
    NEXT_PUBLIC_ACCESS_KEY_LOGIN_ENABLED=${NEXT_PUBLIC_ACCESS_KEY_LOGIN_ENABLED} \
    NEXT_PUBLIC_ACCESS_KEY=${NEXT_PUBLIC_ACCESS_KEY} \
    NEXT_PUBLIC_ACCESS_KEY_LOGIN_CODE=${NEXT_PUBLIC_ACCESS_KEY_LOGIN_CODE}

COPY . .
RUN mkdir -p public && pnpm build

FROM node:22-bookworm-slim@sha256:f32b81066cde10a75dbac96646099533316d94bac4150c55da1636e1f0ffdc46 AS runner

ARG APP_VERSION=unknown
ARG VCS_REF=unknown

LABEL org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.source="https://github.com/YuanYuan152/WeChat-Appointment-Mini-Program"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["node", "server.js"]
