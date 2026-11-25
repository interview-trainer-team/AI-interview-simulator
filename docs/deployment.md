# Развёртывание на сервере

Весь проект запускается одной командой через Docker Compose: PostgreSQL, backend (Django + gunicorn) и Caddy,
который раздаёт собранный frontend и проксирует `/api`, `/admin`, `/static` на backend.
Сайт и API живут на одном адресе, поэтому CORS на сервере не нужен.

```
браузер → Caddy (80/443) ─┬─ /api, /admin, /static → backend (gunicorn :8000) → PostgreSQL
                          └─ всё остальное → собранный frontend
```

## Что нужно

- Сервер (VPS) с Ubuntu 22.04/24.04, от 2 ГБ памяти, открытые порты 80 и 443.
- Домен с A-записью на IP сервера (если нужен HTTPS; без домена сайт работает по HTTP на IP).
- Доступ к LLM: ключ и адрес OpenAI-совместимого провайдера. С российских IP OpenAI недоступен,
  используйте провайдера, доступного с вашего сервера.

## Первый запуск

```bash
# 1. Docker (один раз)
curl -fsSL https://get.docker.com | sh

# 2. Код
git clone https://github.com/interview-trainer-team/AI-interview-simulator.git
cd AI-interview-simulator

# 3. Настройки
cp .env.example .env
nano .env        # заполнить по таблице ниже

# 4. Сборка и запуск (миграции и сбор статики выполняются при старте backend)
docker compose up -d --build

# 5. Вопросы для интервью и администратор (один раз)
docker compose exec backend python manage.py loaddata questions
docker compose exec backend python manage.py createsuperuser
```

Проверка: откройте `http://IP-сервера/` или `https://ваш-домен/`, пройдите регистрацию и вход.

## Файл .env на сервере

| Переменная | Значение |
|---|---|
| `SECRET_KEY` | случайная строка: `python3 -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | домен или IP сайта через запятую, например `example.com` |
| `DB_NAME`, `DB_USER` | можно оставить `interview_db`, `postgres` |
| `DB_PASSWORD` | придумайте надёжный пароль (без пробелов и кавычек); обязателен |
| `SITE_ADDRESS` | домен (`example.com`): Caddy сам получит HTTPS-сертификат. Без домена: `:80` |
| `CSRF_TRUSTED_ORIGINS` | `https://example.com` (нужно для входа в админку) |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | данные LLM-провайдера |
| `LLM_PROVIDER` | не задавать. `stub` только для демонстрации без LLM: ответы-заглушки |

`DB_HOST` задавать не нужно: в `docker-compose.yml` он указывает на контейнер `db`.
Файл `.env` содержит секреты и в репозиторий не попадает.

## Обновление версии

```bash
git pull
docker compose up -d --build
```

Данные БД хранятся в томе `pgdata` и при пересборке не теряются.

## Полезные команды

```bash
docker compose ps                    # состояние контейнеров
docker compose logs -f backend       # логи backend
docker compose logs -f web           # логи Caddy
docker compose exec -T db pg_dump -U postgres interview_db > backup.sql   # резервная копия БД
```

## Частые проблемы

| Симптом | Причина |
|---|---|
| `400 Bad Request` на любой странице | домен или IP не указан в `ALLOWED_HOSTS` |
| В админке `403 CSRF` при входе | не задан `CSRF_TRUSTED_ORIGINS` (с `https://`) |
| Сайт открывается, но ответы на вопросы получают статус «не удалось проанализировать» | LLM недоступен: проверьте `LLM_API_KEY`, `LLM_BASE_URL`, доступ с сервера (`docker compose logs backend`) |
| Нет HTTPS | домен не указывает на сервер или в `SITE_ADDRESS` указан не домен; порты 80 и 443 должны быть открыты |
| Контейнер `backend` перезапускается | смотрите `docker compose logs backend`: обычно не задан `SECRET_KEY` или неверный пароль БД |
