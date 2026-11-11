from django.urls import path
from .views import LoginView
from .views import LoginView, RegisterView

urlpatterns = [
    path('api/auth/login', LoginView.as_view(), name='login'),
    path('api/auth/register', RegisterView.as_view(), name='register'),
]