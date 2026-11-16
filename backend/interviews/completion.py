from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from .feedback import create_pending_feedback
from .models import AnalysisStatus, Answer, InterviewStatus


def finish_interview(interview, finished_early=False):
    """Завершение интервью (docs/api.md, «Завершение интервью»), шаги 1–3 до запроса к LLM.

    Ставит статус, время завершения и итоговый балл, создаёт запись рекомендаций со статусом PENDING.
    Сам запрос к LLM (feedback.run_feedback) вызывающий код делает после коммита транзакции,
    чтобы не держать блокировку, пока LLM отвечает.
    """
    scores = list(
        Answer.objects.filter(
            interview_question__interview=interview,
            analysis_status=AnalysisStatus.DONE,
            score__isnull=False,
        ).values_list("score", flat=True)
    )
    total = None
    if scores:
        total = (Decimal(sum(scores)) / len(scores)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)

    interview.status = InterviewStatus.COMPLETED
    interview.completed_at = timezone.now()
    interview.finished_early = finished_early
    interview.total_score = total
    interview.save(update_fields=["status", "completed_at", "finished_early", "total_score"])
    create_pending_feedback(interview)


def finish_if_all_done(interview):
    """Автозавершение после последнего ответа: все вопросы отвечены и все ответы в статусе DONE.

    Возвращает True, если интервью было завершено этим вызовом (тогда нужно запустить run_feedback).
    """
    if interview.status == InterviewStatus.COMPLETED:
        return False
    total = interview.interview_questions.count()
    done = Answer.objects.filter(
        interview_question__interview=interview, analysis_status=AnalysisStatus.DONE
    ).count()
    if total and done == total:
        finish_interview(interview)
        return True
    return False