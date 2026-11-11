from django.urls import path
from .views import LoginView
from .views import LoginView, RegisterView, MeView

urlpatterns = [
    path('api/auth/login', LoginView.as_view(), name='login'),
    path('api/auth/register', RegisterView.as_view(), name='register'),
    path('api/users/me', MeView.as_view(), name='me'),
]