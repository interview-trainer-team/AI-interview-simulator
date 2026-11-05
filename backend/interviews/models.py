from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Level(models.TextChoices):
    JUNIOR = "JUNIOR", "Junior"
    MIDDLE = "MIDDLE", "Middle"


class InterviewStatus(models.TextChoices):
    CREATED = "CREATED", "Создано"
    IN_PROGRESS = "IN_PROGRESS", "В процессе"
    COMPLETED = "COMPLETED", "Завершено"


class Interview(models.Model):
    #Одно интервью пользователя: направление, уровень, статус и итоговая оценка

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="interviews",
    )
    direction = models.CharField(max_length=100)
    level = models.CharField(max_length=10, choices=Level.choices)
    status = models.CharField(
        max_length=20,
        choices=InterviewStatus.choices,
        default=InterviewStatus.CREATED,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    total_score = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(level__in=Level.values),
                name="interview_level_valid",
            ),
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
        return f"Интервью #{self.pk}: {self.direction}, {self.level} ({self.status})"


class Question(models.Model):
    #Вопрос из банка вопросов

    text = models.TextField()
    direction = models.CharField(max_length=100)
    level = models.CharField(max_length=10, choices=Level.choices)

    class Meta:
        ordering = ["direction", "level", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(level__in=Level.values),
                name="question_level_valid",
            ),
        ]

    def __str__(self):
        return f"[{self.direction}, {self.level}] {self.text[:60]}"


class Answer(models.Model):
    #Ответ на один вопрос внутри интервью и его оценка

    interview = models.ForeignKey(
        Interview,
        on_delete=models.CASCADE,
        related_name="answers",
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.PROTECT,
        related_name="answers",
    )
    #Порядковый номер вопроса в интервью (1-5)
    order_number = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    answer_text = models.TextField(blank=True)
    score = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
    )
    strengths = models.TextField(blank=True)
    weaknesses = models.TextField(blank=True)
    recommendation = models.TextField(blank=True)

    class Meta:
        ordering = ["interview", "order_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["interview", "question"],
                name="unique_question_per_interview",
            ),
            models.UniqueConstraint(
                fields=["interview", "order_number"],
                name="unique_order_per_interview",
            ),
            models.CheckConstraint(
                condition=models.Q(order_number__gte=1, order_number__lte=5),
                name="answer_order_1_5",
            ),
            models.CheckConstraint(
                condition=models.Q(score__isnull=True)
                | models.Q(score__gte=0, score__lte=10),
                name="answer_score_0_10",
            ),
        ]

    def __str__(self):
        return f"Ответ {self.order_number} в интервью #{self.interview_id}"