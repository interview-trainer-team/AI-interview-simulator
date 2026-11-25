# Сборка frontend и веб-сервер Caddy (раздаёт сайт и проксирует /api на backend).
# Контекст сборки: корень репозитория.

FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
# Адрес API по умолчанию /api (тот же домен), VITE_API_BASE_URL не задаём
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
