# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npx prisma generate
RUN npx nest build 2>&1; echo "Exit code: $?"
RUN ls -la dist/ || echo "dist/ is empty or missing"
RUN find dist/ -name '*.js' 2>/dev/null | head -20 || echo "no js files found"

# Stage 2: Production
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/prisma.config.ts ./
RUN npm ci --omit=dev
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
