from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .errors import error_response
from .models import Direction, Interview, InterviewQuestion, InterviewStatus, Level
from .services import QUESTIONS_PER_INTERVIEW, pick_bank_questions, to_utc_iso

ACTIVE_STATUSES = [InterviewStatus.CREATED, InterviewStatus.IN_PROGRESS]


class DirectionListView(APIView):
    """GET /api/directions: позиции и уровни для экрана настройки интервью."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        directions = Direction.objects.filter(is_active=True)  # порядок: sort_order
        levels = Level.objects.all()
        return Response(
            {
                "directions": [
                    {"code": d.code, "name": d.name, "description": d.description}
                    for d in directions
                ],
                "levels": [
                    {"code": lv.code, "name": lv.name, "description": lv.description}
                    for lv in levels
                ],
            }
        )


class InterviewListCreateView(APIView):
    """POST /api/interviews: создать интервью. GET /api/interviews: история."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        direction_code = request.data.get("directionCode")
        level_code = request.data.get("levelCode")

        fields = {}
        if not isinstance(direction_code, str) or not direction_code.strip():
            fields["directionCode"] = "Укажите позицию"
        if not isinstance(level_code, str) or not level_code.strip():
            fields["levelCode"] = "Укажите уровень"
        if fields:
            return error_response(
                "VALIDATION_ERROR",
                "Проверьте введённые данные",
                status.HTTP_400_BAD_REQUEST,
                {"fields": fields},
            )

        direction = Direction.objects.filter(code=direction_code.strip(), is_active=True).first()
        if direction is None:
            return error_response(
                "UNKNOWN_DIRECTION", "Такой позиции нет", status.HTTP_400_BAD_REQUEST
            )
        level = Level.objects.filter(code=level_code.strip()).first()
        if level is None:
            return error_response("UNKNOWN_LEVEL", "Такого уровня нет", status.HTTP_400_BAD_REQUEST)

        # Вопрос 3 из документа: пока нельзя иметь два незавершённых интервью
        active = Interview.objects.filter(user=request.user, status__in=ACTIVE_STATUSES).first()
        if active is not None:
            return error_response(
                "ACTIVE_INTERVIEW_EXISTS",
                "У вас уже есть незавершённое интервью",
                status.HTTP_409_CONFLICT,
                {"interviewId": str(active.id)},
            )

        questions = pick_bank_questions(direction, level)
        if questions is None:
            return error_response(
                "QUESTIONS_UNAVAILABLE",
                "Не удалось подобрать вопросы, попробуйте позже",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        with transaction.atomic():
            interview = Interview.objects.create(
                user=request.user, direction=direction, level=level
            )
            InterviewQuestion.objects.bulk_create(
                [
                    InterviewQuestion(interview=interview, question=question, position=position)
                    for position, question in enumerate(questions, start=1)
                ]
            )

        return Response(
            {
                "id": str(interview.id),
                "status": interview.status,
                "directionCode": direction.code,
                "levelCode": level.code,
                "totalQuestions": QUESTIONS_PER_INTERVIEW,
                "createdAt": to_utc_iso(interview.created_at),
            },
            status=status.HTTP_201_CREATED,
        )

    def get(self, request):
        status_param = request.query_params.get("status", "COMPLETED")
        if status_param == "COMPLETED":
            statuses = [InterviewStatus.COMPLETED]
        elif status_param == "ACTIVE":
            statuses = ACTIVE_STATUSES
        else:
            return error_response(
                "VALIDATION_ERROR",
                "Проверьте введённые данные",
                status.HTTP_400_BAD_REQUEST,
                {"fields": {"status": "Допустимые значения: COMPLETED, ACTIVE"}},
            )

        interviews = Interview.objects.filter(
            user=request.user, status__in=statuses
        ).select_related("direction", "level")  # новые сверху: порядок модели -created_at

        return Response(
            {
                "items": [
                    {
                        "id": str(i.id),
                        "status": i.status,
                        "directionName": i.direction.name,
                        "levelName": i.level.name,
                        "finishedEarly": i.finished_early,
                        "completedAt": to_utc_iso(i.completed_at),
                        "totalScore": float(i.total_score) if i.total_score is not None else None,
                    }
                    for i in interviews
                ]
            }
        )