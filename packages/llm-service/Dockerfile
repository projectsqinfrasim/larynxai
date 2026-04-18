FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/llm-service/package.json ./packages/llm-service/
RUN pnpm install --frozen-lockfile --filter @larynxai/shared --filter @larynxai/llm-service
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/llm-service ./packages/llm-service
RUN pnpm --filter @larynxai/shared build
RUN pnpm --filter @larynxai/llm-service build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/packages/llm-service/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./node_modules/@larynxai/shared/dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@larynxai/shared/package.json
ENV NODE_ENV=production PORT=3003
EXPOSE 3003
CMD ["node", "dist/index.js"]
