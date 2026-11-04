# Backend — ИИ-тренажёр собеседований

Серверная часть приложения: **Python (Django + Django REST Framework)** и база данных **PostgreSQL**. Здесь инструкция, как запустить backend у себя на компьютере.

## Что нужно заранее

- [Python](https://www.python.org/downloads/) 3.11 или новее (при установке отметьте **Add python.exe to PATH**)
- [PostgreSQL](https://www.postgresql.org/download/) 16 или новее вместе с pgAdmin 4
- [Git](https://git-scm.com/downloads)

## Запуск

Команды выполняются в терминале (Git Bash, PowerShell или Terminal).

### 1. Скачайте проект

```bash
git clone https://github.com/interview-trainer-team/AI-interview-simulator.git
cd AI-interview-simulator
git checkout feature/5-backend-setup
```

> Строка с `git checkout` нужна, пока ветка не влита в `main`. После слияния её можно не выполнять.

### 2. Создайте пустую базу данных

В pgAdmin 4: правой кнопкой по **Databases → Create → Database**, имя `interview_db`, **Save**.

### 3. Создайте файл `.env`

Файл с настройками не хранится в репозитории, его нужно создать из шаблона:

```bash
cp .env.example .env
```

Откройте `.env` и заполните **два значения**, остальные уже стоят правильно:

- `DB_PASSWORD` — пароль пользователя `postgres`, который вы задали при установке PostgreSQL
- `SECRET_KEY` — любая случайная строка, её можно получить командой:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(50))"
  ```

### 4. Установите зависимости

```bash
cd backend
python -m venv venv
```

Активируйте окружение:

| Система | Команда |
|---|---|
| Git Bash (Windows) | `source venv/Scripts/activate` |
| PowerShell (Windows) | `.\venv\Scripts\Activate.ps1` |
| Mac / Linux | `source venv/bin/activate` |

Когда в начале строки появилось `(venv)`:

```bash
pip install -r requirements.txt
```

### 5. Создайте таблицы и запустите сервер

```bash
python manage.py migrate
python manage.py runserver
```

## Как понять, что всё работает

- `migrate` завершилась без ошибок (строки `Applying ... OK`).
- По адресу http://localhost:8000 открылась стартовая страница Django.
- В pgAdmin в базе `interview_db` → **Schemas → public → Tables** появились таблицы.

Остановить сервер: `Ctrl+C`.

## Если что-то не работает

| Ошибка | Что делать |
|---|---|
| `password authentication failed` | неверный `DB_PASSWORD` в `.env` |
| `database "interview_db" does not exist` | создайте базу в pgAdmin (шаг 2) |
| `connection refused` | запустите службу PostgreSQL |
| `ModuleNotFoundError` | не активировано окружение: в терминале нет `(venv)` |
| `UnicodeDecodeError` при `migrate` | обычно та же причина: неверный пароль или имя базы |