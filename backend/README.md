# Backend — ИИ-тренажёр собеседований

Серверная часть приложения: **Python (Django + Django REST Framework)** и база данных **PostgreSQL**.

## Что уже есть

- Django-проект с подключением к PostgreSQL и настройкой CORS для frontend.
- Таблицы в базе по ER-диаграмме (`docs/data-model.md`): пользователи и отозванные токены, справочники позиций и уровней, вопросы, интервью, вопросы интервью, ответы с разбором и итоговые рекомендации.
- Справочники позиций (`backend_python`) и уровней (`junior`, `middle`) заполняются миграцией.
- 20 тестовых вопросов по Python с эталонными ответами (по 10 на уровни Junior и Middle).
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

Введите email, ФИО и пароль. Если в Git Bash ввод пароля зависает, добавьте `winpty` перед командой:
`winpty python manage.py createsuperuser`.

### 7. Запустите сервер

```bash
python manage.py runserver
```

Остановить сервер: `Ctrl+C`.

## Как проверить, что всё работает

**1. Админка.** Откройте http://localhost:8000/admin и войдите под созданным администратором. Что попробовать:

- **Directions** и **Levels** — справочники: одна позиция (`backend_python`) и два уровня (`junior`, `middle`).
- **Questions** — должно быть 20 вопросов. Их можно фильтровать по уровню и искать по тексту, у каждого есть эталонный ответ.
- **Users** — здесь ваш администратор. Можно создать ещё одного пользователя: пароль сохраняется в зашифрованном виде, email хранится в нижнем регистре, повторить его нельзя.
- **Interviews** — нажмите **Add interview**, выберите пользователя, позицию и уровень. Ниже можно добавить пять вопросов интервью с позициями от 1 до 5. Один вопрос и одну позицию в интервью нельзя использовать дважды.
- **Answers** — ответы с оценками (от 0 до 10) и статусом анализа. На один вопрос интервью можно дать только один ответ.

**2. Таблицы в базе.** В pgAdmin: `interview_db → Schemas → public → Tables`. Должны быть `users_user`, `users_revokedtoken`, `interviews_direction`, `interviews_level`, `interviews_question`, `interviews_interview`, `interviews_interviewquestion`, `interviews_answer`, `interviews_interviewfeedback`.

**3. Автотесты.**

```bash
python manage.py test
```

В конце должно быть `Ran 26 tests ... OK`. Тесты проверяют уникальность email без учёта регистра, хеширование пароля, справочники, допустимые статусы, диапазон оценки 0–10, порядок и уникальность вопросов в интервью, каскадное удаление данных пользователя и наличие 10+ вопросов на каждый уровень.

## Если вы создаёте свою ветку

Работайте от свежего `main`:

```bash
git checkout main
git pull
git checkout -b feature/<номер-задачи>-<кратко>
```

Файлы `.env` и папка `venv` в Git не попадают