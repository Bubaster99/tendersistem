# Образ для разработки: исходники подключаются папкой, изменения видны сразу.
FROM node:22-alpine
ENV TZ=Europe/Moscow
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
EXPOSE 3000
# При старте: доустановить новые библиотеки (если package.json менялся), обновить базу,
# засеять справочники и тестовые данные (повторно ничего не дублируется), запустить сайт.
CMD ["sh", "-c", "npm install --no-audit --no-fund && npx prisma migrate deploy && npx prisma db seed && npm run dev -- -H 0.0.0.0"]
