import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class InterviewStatus(models.TextChoices):
    CREATED = "CREATED", "Создано"
    IN_PROGRESS = "IN_PROGRESS", "В процессе"
    COMPLETED = "COMPLETED", "Завершено"


class QuestionSource(models.TextChoices):
    BANK = "BANK", "Из базы"
    LLM = "LLM", "Сгенерирован LLM"


class AnalysisStatus(models.TextChoices):
    PENDING = "PENDING", "Ожидает"
    DONE = "DONE", "Готово"
    FAILED = "FAILED", "Ошибка"


class LevelVerdict(models.TextChoices):
    MATCH = "MATCH", "Соответствует"
    PARTIAL = "PARTIAL", "Частично"
    BELOW = "BELOW", "Ниже уровня"


class Direction(models.Model):
    """Справочник позиций (таблица directions)."""

    code = models.CharField(max_length=50, primary_key=True)  # например, backend_python
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]

    def __str__(self):
        return self.name


class Level(models.Model):
    """Справочник уровней (таблица levels): junior, middle."""

    code = models.CharField(max_length=20, primary_key=True)
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]

    def __str__(self):
        return self.name


class Question(models.Model):
    """Вопрос: из базы или сгенерированный LLM (таблица questions)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    direction = models.ForeignKey(
        Direction, on_delete=models.PROTECT, related_name="questions", db_column="direction_code"
    )
    level = models.ForeignKey(
        Level, on_delete=models.PROTECT, related_name="questions", db_column="level_code"
    )
    text = models.TextField()
    reference_answer = models.TextField(null=True, blank=True)  # эталонный ответ для оценки
    source = models.CharField(
        max_length=10, choices=QuestionSource.choices, default=QuestionSource.BANK
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["direction", "level", "created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(source__in=QuestionSource.values),
                name="question_source_valid",
            ),
        ]

    def __str__(self):
        return f"[{self.direction_id}, {self.level_id}] {self.text[:60]}"


class Interview(models.Model):
    """Интервью пользователя (таблица interviews)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="interviews",
    )
    direction = models.ForeignKey(
        Direction, on_delete=models.PROTECT, related_name="interviews", db_column="direction_code"
    )
    level = models.ForeignKey(
        Level, on_delete=models.PROTECT, related_name="interviews", db_column="level_code"
    )
    status = models.CharField(
        max_length=20,
        choices=InterviewStatus.choices,
        default=InterviewStatus.CREATED,
    )
    finished_early = models.BooleanField(default=False)
    total_score = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=InterviewStatus.values),
                name="interview_status_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(total_score__isnull=True)
                | models.Q(total_score__gte=0, total_score__lte=10),
                name="interview_total_score_0_10",
            ),
        ]

    def __str__(self):
        return f"Интервью {self.id} ({self.direction_id}, {self.level_id}, {self.status})"


class InterviewQuestion(models.Model):
    """Какие 5 вопросов входят в интервью и в каком порядке (таблица interview_questions)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    interview = models.ForeignKey(
        Interview, on_delete=models.CASCADE, related_name="interview_questions"
    )
    question = models.ForeignKey(
        Question, on_delete=models.PROTECT, related_name="interview_questions"
    )
    position = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )

    class Meta:
        ordering = ["interview", "position"]
        constraints = [
            models.UniqueConstraint(
                fields=["interview", "question"], name="unique_question_per_interview"
            ),
            models.UniqueConstraint(
                fields=["interview", "position"], name="unique_position_per_interview"
            ),
            models.CheckConstraint(
                condition=models.Q(position__gte=1, position__lte=5),
                name="interview_question_position_1_5",
            ),
        ]

    def __str__(self):
        return f"Вопрос {self.position} интервью {self.interview_id}"


class Answer(models.Model):
    """Ответ на вопрос интервью и его разбор от LLM (таблица answers)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Один ответ на один вопрос интервью. Через эту связь определяются интервью и вопрос.
    interview_question = models.OneToOneField(
        InterviewQuestion, on_delete=models.CASCADE, related_name="answer"
    )
    answer_text = models.TextField()
    analysis_status = models.CharField(
        max_length=10, choices=AnalysisStatus.choices, default=AnalysisStatus.PENDING
    )
    score = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
    )
    criteria = models.JSONField(default=dict, blank=True)  # точность, полнота, читаемость
    strengths = models.JSONField(default=list, blank=True)
    weaknesses = models.JSONField(default=list, blank=True)
    recommendation = models.TextField(blank=True)
    analysis_attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    analyzed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["interview_question__interview", "interview_question__position"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(analysis_status__in=AnalysisStatus.values),
                name="answer_analysis_status_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(score__isnull=True)
                | models.Q(score__gte=0, score__lte=10),
                name="answer_score_0_10",
            ),
        ]

    @property
    def interview(self):
        return self.interview_question.interview

    @property
    def question(self):
        return self.interview_question.question

    def __str__(self):
        return f"Ответ на вопрос {self.interview_question_id}"


class InterviewFeedback(models.Model):
    """Итоговые рекомендации по интервью (таблица interview_feedback)."""

    interview = models.OneToOneField(
        Interview, on_delete=models.CASCADE, primary_key=True, related_name="feedback"
    )
    status = models.CharField(
        max_length=10, choices=AnalysisStatus.choices, default=AnalysisStatus.PENDING
    )
    summary = models.TextField(blank=True)
    strong_topics = models.JSONField(default=list, blank=True)
    weak_topics = models.JSONField(default=list, blank=True)
    recommendations = models.JSONField(default=list, blank=True)
    level_verdict = models.CharField(
        max_length=10, choices=LevelVerdict.choices, null=True, blank=True
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=AnalysisStatus.values),
                name="feedback_status_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(level_verdict__isnull=True)
                | models.Q(level_verdict__in=LevelVerdict.values),
                name="feedback_level_verdict_valid",
            ),
        ]

    def __str__(self):
        return f"Рекомендации по интервью {self.interview_id}"
