from django.urls import path

from .flow_views import (
    AnswerCreateView,
    AnswerRetryView,
    CurrentQuestionView,
    InterviewDetailView,
)
from .views import DirectionListView, InterviewListCreateView

urlpatterns = [
    path("api/directions", DirectionListView.as_view(), name="directions"),
    path("api/interviews", InterviewListCreateView.as_view(), name="interviews"),
    path("api/interviews/<str:interview_id>", InterviewDetailView.as_view(), name="interview"),
    path(
        "api/interviews/<str:interview_id>/questions/current",
        CurrentQuestionView.as_view(),
        name="current-question",
    ),
    path(
        "api/interviews/<str:interview_id>/answers",
        AnswerCreateView.as_view(),
        name="answers",
    ),
    path(
        "api/interviews/<str:interview_id>/answers/<str:answer_id>/retry",
        AnswerRetryView.as_view(),
        name="answer-retry",
    ),
]