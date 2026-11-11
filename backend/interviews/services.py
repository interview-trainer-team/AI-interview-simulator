import random
from datetime import timezone as dt_timezone

from .models import Question

QUESTIONS_PER_INTERVIEW = 5


def to_utc_iso(value):
    """Дата в ISO 8601 в UTC с буквой Z (API-контракт, 8.6)."""
    if value is None:
        return None
    return value.astimezone(dt_timezone.utc).isoformat().replace("+00:00", "Z")


def pick_bank_questions(direction, level):
    """5 случайных активных вопросов из базы для позиции и уровня.

    Возвращает None, если в базе меньше 5 вопросов.
    Позже сюда добавится генерация через LLM, а этот вариант станет запасным.
    """
    ids = list(
        Question.objects.filter(direction=direction, level=level, is_active=True).values_list(
            "id", flat=True
        )
    )
    if len(ids) < QUESTIONS_PER_INTERVIEW:
        return None
    chosen = random.sample(ids, QUESTIONS_PER_INTERVIEW)
    by_id = Question.objects.in_bulk(chosen)
    return [by_id[question_id] for question_id in chosen]