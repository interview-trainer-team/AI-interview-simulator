from django.urls import path

from .views import DirectionListView, InterviewListCreateView

urlpatterns = [
    path("api/directions", DirectionListView.as_view(), name="directions"),
    path("api/interviews", InterviewListCreateView.as_view(), name="interviews"),
]