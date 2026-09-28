# Образ для разработки: исходники подключаются папкой, изменения видны сразу.
FROM node:22-alpine
RUN apk add --no-cache openssl tzdata
ENV TZ=Europe/Moscow
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev -- -H 0.0.0.0"]
