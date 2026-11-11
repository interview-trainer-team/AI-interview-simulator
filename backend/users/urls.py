from django.urls import path
from .views import LoginView

urlpatterns = [
    path('api/auth/login', LoginView.as_view(), name='login'),
]