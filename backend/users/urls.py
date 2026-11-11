from django.urls import path
from .views import LoginView, RegisterView, MeView, LogoutView

urlpatterns = [
    path('api/auth/login', LoginView.as_view(), name='login'),
    path('api/auth/register', RegisterView.as_view(), name='register'),
    path('api/auth/logout', LogoutView.as_view(), name='logout'),
    path('api/users/me', MeView.as_view(), name='me'), 
]