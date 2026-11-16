from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .access import expire_stale_pending, get_user_interview
from .completion import finish_interview
from .errors import ApiError, ApiView
from .feedback import expire_stale_feedback, feedback_payload, run_feedback
from .flow_views import failed_answer_ids
from .models import AnalysisStatus, Answer, InterviewFeedback, InterviewStatus
from .services import to_utc_iso


def total_score_value(interview):
    return float(interview.total_score) if interview.total_score is not None else None


def require_completed(interview):
    if interview.status != InterviewStatus.COMPLETED:
        raise ApiError("INTERVIEW_NOT_COMPLETED", "Интервью ещё не завершено", 409)


class CompleteInterviewView(ApiView):
    """POST /api/interviews/{id}/complete: досрочное завершение."""

    permission_classes = [IsAuthenticated]

    def post(self, request, interview_id):
        finished_now = False
        with transaction.atomic():
            interview = get_user_interview(request, interview_id, for_update=True)
            # Уже завершено: повторный вызов безопасен, возвращаем текущие данные
            if interview.status != InterviewStatus.COMPLETED:
                expire_stale_pending(interview)
                answers = Answer.objects.filter(interview_question__interview=interview)
                if not answers.exists():
                    raise ApiError("NO_ANSWERS", "Нет ни одного ответа", 409)
                failed_ids = failed_answer_ids(interview)
                if failed_ids:
                    raise ApiError(
                        "ANALYSIS_FAILED",
                        "Часть ответов не проанализирована",
                        409,
                        {"failedAnswerIds": failed_ids},
                    )
                if answers.filter(analysis_status=AnalysisStatus.PENDING).exists():
                    raise ApiError("ANALYSIS_PENDING", "Ответ ещё анализируется", 409)
                finish_interview(interview, finished_early=True)
                finished_now = True

        # Рекомендации запрашиваем после коммита: их сбой не отменяет завершение интервью
        if finished_now:
            run_feedback(interview)

        return Response(
            {
                "id": str(interview.id),
                "status": interview.status,
                "finishedEarly": interview.finished_early,
                "totalScore": total_score_value(interview),
            }
        )


class ResultsView(ApiView):
    """GET /api/interviews/{id}/results: результаты интервью."""

    permission_classes = [IsAuthenticated]

    def get(self, request, interview_id):
        interview = get_user_interview(request, interview_id)
        require_completed(interview)
        expire_stale_feedback(interview)

        feedback = InterviewFeedback.objects.filter(pk=interview.pk).first()
        answers = {
            answer.interview_question_id: answer
            for answer in Answer.objects.filter(interview_question__interview=interview)
        }
        items = []
        for link in interview.interview_questions.select_related("question").order_by("position"):
            answer = answers.get(link.id)
            analyzed = answer is not None and answer.analysis_status == AnalysisStatus.DONE
            items.append(
                {
                    "position": link.position,
                    "questionText": link.question.text,
                    "answerText": answer.answer_text if answer else None,
                    "score": answer.score if analyzed else None,
                    "criteria": answer.criteria if analyzed else None,
                    "strengths": answer.strengths if analyzed else [],
                    "weaknesses": answer.weaknesses if analyzed else [],
                    "recommendation": answer.recommendation if analyzed else None,
                }
            )

        return Response(
            {
                "id": str(interview.id),
                "directionName": interview.direction.name,
                "levelName": interview.level.name,
                "finishedEarly": interview.finished_early,
                "completedAt": to_utc_iso(interview.completed_at),
                "totalScore": total_score_value(interview),
                "feedback": feedback_payload(feedback),
                "items": items,
            }
        )


class FeedbackRetryView(ApiView):
    """POST /api/interviews/{id}/feedback/retry: повторить формирование итоговых рекомендаций."""

    permission_classes = [IsAuthenticated]

    def post(self, request, interview_id):
        # Одна транзакция: строки интервью и рекомендаций заблокированы, параллельный повтор
        # подождёт и получит 409. При сбое сервера рекомендации останутся FAILED.
        with transaction.atomic():
            interview = get_user_interview(request, interview_id, for_update=True)
            require_completed(interview)
            expire_stale_feedback(interview)
            feedback, _ = InterviewFeedback.objects.select_for_update().get_or_create(
                interview=interview, defaults={"status": AnalysisStatus.FAILED}
            )
            if feedback.status != AnalysisStatus.FAILED:
                raise ApiError(
                    "FEEDBACK_NOT_FAILED",
                    "Рекомендации уже сформированы или ещё формируются",
                    409,
                )
            feedback = run_feedback(interview, expected_status=AnalysisStatus.FAILED)
        return Response(feedback_payload(feedback))