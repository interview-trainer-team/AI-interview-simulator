# Backend — ИИ-тренажёр собеседований

Серверная часть приложения: **Python (Django + Django REST Framework)** и база данных **PostgreSQL**.

## Что уже есть

- Django-проект с подключением к PostgreSQL и настройкой CORS для frontend.
- Таблицы в базе (модели): **User**, **Interview**, **Question**, **Answer**.
- 20 тестовых вопросов по Python (по 10 на уровни Junior и Middle).
- Админка Django, где можно смотреть и создавать данные.
- Автотесты моделей.

API (регистрация, вход, интервью) ещё в разработке, поэтому проверять работу сейчас можно через админку и тесты.

## Что нужно установить

| Программа | Версия | Зачем |
|---|---|---|
| [Python](https://www.python.org/downloads/) | 3.11 или новее (при установке отметьте **Add python.exe to PATH**) | язык backend |
| [PostgreSQL](https://www.postgresql.org/download/) | 16 или новее, вместе с pgAdmin 4 | база данных |
| [Git](https://git-scm.com/downloads) | любая | работа с репозиторием |

## Запуск

Команды выполняются в терминале (Git Bash, PowerShell или Terminal на Mac/Linux).

### 1. Скачайте проект

```bash
git clone https://github.com/interview-trainer-team/AI-interview-simulator.git
cd AI-interview-simulator
```

Если проект уже скачан, обновите его:

```bash
git checkout main
git pull
```

### 2. Создайте пустую базу данных

В pgAdmin 4: правой кнопкой по **Databases → Create → Database**, имя `interview_db`, **Save**.

### 3. Создайте файл `.env`

Файл с настройками не хранится в репозитории, его нужно создать из шаблона. В корне проекта:

```bash
cp .env.example .env
```

Откройте `.env` и заполните **два значения**, остальные уже подходят:

- `DB_PASSWORD` — пароль пользователя `postgres`, который вы задали при установке PostgreSQL
- `SECRET_KEY` — любая случайная строка, её можно получить командой:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(50))"
  ```

### 4. Создайте виртуальное окружение и установите зависимости

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

Когда в начале строки появится `(venv)`:

```bash
pip install -r requirements.txt
```

### 5. Создайте таблицы и загрузите вопросы

```bash
python manage.py migrate
python manage.py loaddata questions
```

Первая команда создаёт таблицы в базе. Вторая загружает 20 тестовых вопросов, повторный запуск дубли не создаёт. После `loaddata` должно появиться сообщение `Installed 20 object(s) from 1 fixture(s)`.

### 6. Создайте администратора

```bash
python manage.py createsuperuser
```

Введите email и пароль. Если в Git Bash ввод пароля зависает, добавьте `winpty` перед командой:
`winpty python manage.py createsuperuser`.

### 7. Запустите сервер

```bash
python manage.py runserver
```

Остановить сервер: `Ctrl+C`.

## Как проверить, что всё работает

**1. Админка.** Откройте http://localhost:8000/admin и войдите под созданным администратором. Что попробовать:

- **Questions** — должно быть 20 вопросов. Их можно фильтровать по уровню и искать по тексту.
- **Users** — здесь ваш администратор. Можно создать ещё одного пользователя: пароль сохраняется в зашифрованном виде, а повторить email нельзя.
- **Interviews** — нажмите **Add interview**, выберите пользователя, укажите направление (например, `Python`), уровень и статус. Ниже можно добавить ответы к вопросам. Интервью не принимает значения вне списка (уровень Junior/Middle, статус Создано / В процессе / Завершено).
- **Answers** — ответы с оценками. Оценка принимает значения от 0 до 10, один и тот же вопрос нельзя добавить в интервью дважды.

**2. Таблицы в базе.** В pgAdmin: `interview_db → Schemas → public → Tables`. Должны быть `users_user`, `interviews_interview`, `interviews_question`, `interviews_answer`.

**3. Автотесты.**

```bash
python manage.py test
```

В конце должно быть `Ran 8 tests ... OK`. Тесты проверяют уникальность email, хеширование пароля, допустимые статусы и уровни, диапазон оценки 0–10, запрет повторного вопроса в интервью и наличие 10+ вопросов на каждый уровень.

## Если вы создаёте свою ветку

Работайте от свежего `main`:

```bash
git checkout main
git pull
git checkout -b feature/<номер-задачи>-<кратко>
```

Файлы `.env` и папка `venv` в Git не попадают