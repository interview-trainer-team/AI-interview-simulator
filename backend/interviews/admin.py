from django.contrib import admin

from .models import (
    Answer,
    Direction,
    Interview,
    InterviewFeedback,
    InterviewQuestion,
    Level,
    Question,
)


@admin.register(Direction)
class DirectionAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active", "sort_order")


@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "sort_order")


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("text", "direction", "level", "source", "is_active")
    list_filter = ("direction", "level", "source", "is_active")
    search_fields = ("text",)


class InterviewQuestionInline(admin.TabularInline):
    model = InterviewQuestion
    extra = 0


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "direction", "level", "status", "total_score", "created_at")
    list_filter = ("status", "level", "direction")
    inlines = [InterviewQuestionInline]


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ("id", "interview_question", "analysis_status", "score")
    list_filter = ("analysis_status",)


@admin.register(InterviewFeedback)
class InterviewFeedbackAdmin(admin.ModelAdmin):
    list_display = ("interview", "status", "level_verdict")
