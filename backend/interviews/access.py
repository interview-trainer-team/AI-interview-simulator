import uuid
from datetime import timedelta

from django.utils import timezone

from .errors import ApiError
from .models import AnalysisStatus, Answer, Interview

# Ответ, который дольше этого времени «ждёт анализ», считаем зависшим (сервер упал во время запроса к LLM)
STALE_PENDING_AFTER = timedelta(minutes=2)


def parse_uuid(value):
    """UUID из строки из URL или None, если это не UUID."""
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None


def get_user_interview(request, interview_id, for_update=False):
    """Общая проверка доступа ко всем методам с {id} интервью (docs/api.md).

    Интервью нет, id не UUID или интервью чужое: одинаковый 404 INTERVIEW_NOT_FOUND,
    чтобы не подтверждать существование чужого интервью (FR-5.10.1).
    for_update=True блокирует строку интервью, вызывать только внутри transaction.atomic().
    """
    interviews = Interview.objects.filter(user=request.user)
    if for_update:
        interviews = interviews.select_for_update()
    parsed = parse_uuid(interview_id)
    interview = interviews.filter(id=parsed).first() if parsed else None
    if interview is None:
        raise ApiError("INTERVIEW_NOT_FOUND", "Интервью не найдено", 404)
    return interview


def expire_stale_pending(interview):
    """[Предложение] Зависшие в PENDING ответы переводим в FAILED, чтобы их можно было повторить."""
    return Answer.objects.filter(
        interview_question__interview=interview,
        analysis_status=AnalysisStatus.PENDING,
        created_at__lt=timezone.now() - STALE_PENDING_AFTER,
    ).update(analysis_status=AnalysisStatus.FAILED)