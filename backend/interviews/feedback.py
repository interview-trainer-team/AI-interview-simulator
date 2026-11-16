from decimal import Decimal

from django.utils import timezone

from .access import STALE_PENDING_AFTER
from .analysis import generate_feedback
from .models import AnalysisStatus, Answer, InterviewFeedback, LevelVerdict

MATCH_FROM = Decimal("7.5")
PARTIAL_FROM = Decimal("5.0")


def level_verdict_for(total_score):
    """Вывод об уровне по итоговому баллу (docs/api.md, «Завершение интервью», шаг 4 [Предложение]).

    От 7.5 MATCH, от 5.0 до 7.4 PARTIAL, ниже 5.0 BELOW.
    """
    if total_score is None:
        return None
    if total_score >= MATCH_FROM:
        return LevelVerdict.MATCH
    if total_score >= PARTIAL_FROM:
        return LevelVerdict.PARTIAL
    return LevelVerdict.BELOW


def create_pending_feedback(interview):
    """Запись interview_feedback со статусом PENDING; вызывается при завершении интервью."""
    InterviewFeedback.objects.update_or_create(
        interview=interview,
        defaults={"status": AnalysisStatus.PENDING, "created_at": timezone.now()},
    )


def expire_stale_feedback(interview):
    """[Предложение] Рекомендации, зависшие в PENDING, переводим в FAILED, чтобы их можно было повторить."""
    return InterviewFeedback.objects.filter(
        interview=interview,
        status=AnalysisStatus.PENDING,
        created_at__lt=timezone.now() - STALE_PENDING_AFTER,
    ).update(status=AnalysisStatus.FAILED)


def build_items(interview):
    """Вопросы интервью по порядку с ответами и оценками для запроса к LLM."""
    answers = {
        answer.interview_question_id: answer
        for answer in Answer.objects.filter(interview_question__interview=interview)
    }
    items = []
    for link in interview.interview_questions.select_related("question").order_by("position"):
        answer = answers.get(link.id)
        items.append(
            {
                "position": link.position,
                "question_text": link.question.text,
                "answer_text": answer.answer_text if answer else None,
                "score": answer.score if answer else None,
            }
        )
    return items


def run_feedback(interview, expected_status=AnalysisStatus.PENDING):
    """Запрашивает у LLM итоговые рекомендации и сохраняет результат.

    Сбой LLM не бросает исключение: рекомендации получают статус FAILED, интервью остаётся
    завершённым. expected_status защищает от перезаписи, если запись уже изменил другой запрос.
    Возвращает актуальную запись InterviewFeedback.
    """
    result = generate_feedback(
        direction_name=interview.direction.name,
        level_name=interview.level.name,
        total_score=interview.total_score,
        items=build_items(interview),
    )
    if result is None:
        fields = {"status": AnalysisStatus.FAILED}
    else:
        fields = {
            "status": AnalysisStatus.DONE,
            "summary": result["summary"],
            "strong_topics": result["strongTopics"],
            "weak_topics": result["weakTopics"],
            "recommendations": result["recommendations"],
            "level_verdict": level_verdict_for(interview.total_score),
        }
    InterviewFeedback.objects.filter(pk=interview.pk, status=expected_status).update(**fields)
    return InterviewFeedback.objects.get(pk=interview.pk)


def feedback_payload(feedback):
    """Блок feedback для результатов и повтора. Без готовых рекомендаций все поля, кроме status, null."""
    if feedback is None:
        # Интервью завершено до появления рекомендаций: считаем, что их нет, и разрешаем повтор
        return _empty_payload(AnalysisStatus.FAILED)
    if feedback.status != AnalysisStatus.DONE:
        return _empty_payload(feedback.status)
    return {
        "status": feedback.status,
        "summary": feedback.summary,
        "strongTopics": feedback.strong_topics,
        "weakTopics": feedback.weak_topics,
        "recommendations": feedback.recommendations,
        "levelVerdict": feedback.level_verdict,
    }


def _empty_payload(status):
    return {
        "status": status,
        "summary": None,
        "strongTopics": None,
        "weakTopics": None,
        "recommendations": None,
        "levelVerdict": None,
    }