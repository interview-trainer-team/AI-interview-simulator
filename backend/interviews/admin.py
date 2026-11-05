from django.contrib import admin

from .models import Answer, Interview, Question


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 0


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "direction", "level", "status", "total_score", "created_at")
    list_filter = ("status", "level", "direction")
    inlines = [AnswerInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "direction", "level", "text")
    list_filter = ("direction", "level")
    search_fields = ("text",)


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ("id", "interview", "order_number", "question", "score")
    list_filter = ("interview",)