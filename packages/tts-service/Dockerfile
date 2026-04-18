FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/tts-service/package.json ./packages/tts-service/
RUN pnpm install --frozen-lockfile --filter @larynxai/shared --filter @larynxai/tts-service
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/tts-service ./packages/tts-service
RUN pnpm --filter @larynxai/shared build
RUN pnpm --filter @larynxai/tts-service build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/packages/tts-service/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./node_modules/@larynxai/shared/dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@larynxai/shared/package.json
ENV NODE_ENV=production PORT=3002
EXPOSE 3002
CMD ["node", "dist/index.js"]
