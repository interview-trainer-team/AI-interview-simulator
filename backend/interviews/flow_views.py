from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .access import expire_stale_pending, get_user_interview, parse_uuid
from .analysis import analyze_answer
from .completion import finish_if_all_done
from .errors import ApiError, ApiView
from .models import AnalysisStatus, Answer, Interview, InterviewStatus
from .services import QUESTIONS_PER_INTERVIEW

MAX_ANSWER_LENGTH = 4000


def next_unanswered(interview):
    """Вопрос интервью с наименьшей позицией, на который ещё нет ответа."""
    return (
        interview.interview_questions.filter(answer__isnull=True)
        .select_related("question")
        .order_by("position")
        .first()
    )


def failed_answer_ids(interview):
    return [
        str(pk)
        for pk in Answer.objects.filter(
            interview_question__interview=interview, analysis_status=AnalysisStatus.FAILED
        ).values_list("id", flat=True)
    ]


def run_analysis(answer):
    """Запрос к LLM и сохранение разбора.

    Сбой LLM не бросает исключение: ответ остаётся в базе со статусом FAILED.
    """
    link = answer.interview_question
    result, attempts = analyze_answer(
        question_text=link.question.text,
        reference_answer=link.question.reference_answer,
        level_name=link.interview.level.name,
        answer_text=answer.answer_text,
    )
    answer.analysis_attempts += attempts
    if result is None:
        answer.analysis_status = AnalysisStatus.FAILED
        answer.save(update_fields=["analysis_status", "analysis_attempts"])
        return
    answer.analysis_status = AnalysisStatus.DONE
    answer.score = result["score"]
    answer.criteria = result["criteria"]
    answer.strengths = result["strengths"]
    answer.weaknesses = result["weaknesses"]
    answer.recommendation = result["recommendation"]
    answer.analyzed_at = timezone.now()
    answer.save(
        update_fields=[
            "analysis_status",
            "score",
            "criteria",
            "strengths",
            "weaknesses",
            "recommendation",
            "analyzed_at",
            "analysis_attempts",
        ]
    )


def answer_result(interview, answer):
    """Тело ответа для отправки ответа и повтора анализа (одинаковое по контракту)."""
    analysis = None
    if answer.analysis_status == AnalysisStatus.DONE:
        analysis = {
            "score": answer.score,
            "criteria": answer.criteria,
            "strengths": answer.strengths,
            "weaknesses": answer.weaknesses,
            "recommendation": answer.recommendation,
        }
    following = next_unanswered(interview)
    return {
        "answerId": str(answer.id),
        "analysisStatus": answer.analysis_status,
        "analysis": analysis,
        "interviewStatus": interview.status,
        "nextPosition": following.position if following else None,
    }


class InterviewDetailView(ApiView):
    """GET /api/interviews/{id}: данные для шапки экрана интервью."""

    permission_classes = [IsAuthenticated]

    def get(self, request, interview_id):
        interview = get_user_interview(request, interview_id)
        return Response(
            {
                "id": str(interview.id),
                "status": interview.status,
                "directionName": interview.direction.name,
                "levelName": interview.level.name,
                "totalQuestions": QUESTIONS_PER_INTERVIEW,
                "answeredCount": Answer.objects.filter(
                    interview_question__interview=interview
                ).count(),
            }
        )


class CurrentQuestionView(ApiView):
    """GET /api/interviews/{id}/questions/current: вопрос, на который ещё нет ответа."""

    permission_classes = [IsAuthenticated]

    def get(self, request, interview_id):
        with transaction.atomic():
            interview = get_user_interview(request, interview_id, for_update=True)
            if interview.status == InterviewStatus.COMPLETED:
                raise ApiError("INTERVIEW_COMPLETED", "Интервью уже завершено", 409)
            expire_stale_pending(interview)
            if interview.status == InterviewStatus.CREATED:
                interview.status = InterviewStatus.IN_PROGRESS
                interview.started_at = timezone.now()
                interview.save(update_fields=["status", "started_at"])
            current = next_unanswered(interview)
            failed_ids = failed_answer_ids(interview) if current is None else []

        if current is None:
            if failed_ids:
                raise ApiError(
                    "ANALYSIS_FAILED",
                    "Часть ответов не проанализирована",
                    409,
                    {"failedAnswerIds": failed_ids},
                )
            # Все ответы есть, но последний ещё анализируется (запрос не завершился)
            raise ApiError("ANALYSIS_PENDING", "Ответ ещё анализируется", 409)

        return Response(
            {
                "position": current.position,
                "totalQuestions": QUESTIONS_PER_INTERVIEW,
                "questionId": str(current.question_id),
                "text": current.question.text,
            }
        )


class AnswerCreateView(ApiView):
    """POST /api/interviews/{id}/answers: сохранить ответ и получить его анализ."""

    permission_classes = [IsAuthenticated]

    def post(self, request, interview_id):
        # Шаг 1. Проверки и сохранение ответа со статусом PENDING (коммит до запроса к LLM,
        # чтобы ответ не потерялся при сбое)
        with transaction.atomic():
            interview = get_user_interview(request, interview_id, for_update=True)
            if interview.status == InterviewStatus.COMPLETED:
                raise ApiError("INTERVIEW_COMPLETED", "Интервью уже завершено", 409)
            if interview.status != InterviewStatus.IN_PROGRESS:
                # Вопрос ещё не выдавался (не было GET .../questions/current)
                raise ApiError("NOT_CURRENT_QUESTION", "Это не текущий вопрос", 409)

            question_id = parse_uuid(request.data.get("questionId"))
            answer_text = request.data.get("answerText")
            fields = {}
            if question_id is None:
                fields["questionId"] = "Укажите вопрос"
            if not isinstance(answer_text, str) or not answer_text.strip():
                fields["answerText"] = "Ответ не должен быть пустым"
            elif len(answer_text.strip()) > MAX_ANSWER_LENGTH:
                fields["answerText"] = f"Ответ не должен быть длиннее {MAX_ANSWER_LENGTH} символов"
            if fields:
                raise ApiError(
                    "VALIDATION_ERROR", "Проверьте введённые данные", 400, {"fields": fields}
                )

            current = next_unanswered(interview)
            if current is None or current.question_id != question_id:
                raise ApiError("NOT_CURRENT_QUESTION", "Это не текущий вопрос", 409)
            answer = Answer.objects.create(
                interview_question=current,
                answer_text=answer_text.strip(),
                analysis_status=AnalysisStatus.PENDING,
            )

        # Шаг 2. Анализ вне транзакции: запрос к LLM может идти до минуты
        run_analysis(answer)

        # Шаг 3. Если это был последний ответ и все разборы готовы, завершаем интервью
        with transaction.atomic():
            interview = Interview.objects.select_for_update().get(pk=interview.pk)
            finish_if_all_done(interview)
            result = answer_result(interview, answer)
        return Response(result, status=201)


class AnswerRetryView(ApiView):
    """POST /api/interviews/{id}/answers/{answerId}/retry: повторить анализ ответа в статусе FAILED."""

    permission_classes = [IsAuthenticated]

    def post(self, request, interview_id, answer_id):
        # Одна транзакция на всё: строки интервью и ответа заблокированы, поэтому
        # параллельный повтор подождёт и получит 409. При сбое сервера ответ останется FAILED.
        with transaction.atomic():
            interview = get_user_interview(request, interview_id, for_update=True)
            expire_stale_pending(interview)
            parsed = parse_uuid(answer_id)
            answer = None
            if parsed:
                answer = (
                    Answer.objects.select_for_update(of=("self",))
                    .select_related("interview_question__question")
                    .filter(id=parsed, interview_question__interview=interview)
                    .first()
                )
            if answer is None:
                raise ApiError("ANSWER_NOT_FOUND", "Ответ не найден", 404)
            if answer.analysis_status != AnalysisStatus.FAILED:
                raise ApiError(
                    "ANALYSIS_NOT_FAILED", "Анализ уже выполнен или ещё выполняется", 409
                )

            run_analysis(answer)
            finish_if_all_done(interview)
            result = answer_result(interview, answer)
        return Response(result)