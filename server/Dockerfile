FROM node:20-alpine AS base
WORKDIR /app

# 安装依赖
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install

# 生成 Prisma Client 与构建
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
# 确保构建产物存在，否则立即报错（避免运行时才报 Cannot find module）
RUN test -f /app/dist/index.js || (echo "Build failed: dist/index.js not found" && ls -la /app && ls -la /app/dist 2>/dev/null; exit 1)

# 生产镜像
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
