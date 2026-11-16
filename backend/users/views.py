import uuid
from datetime import datetime, timezone, timedelta
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from .serializers import LoginSerializer, RegisterSerializer
from .models import RevokedToken
from .exceptions import EmailAlreadyExists

User = get_user_model()

def to_utc_iso(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ') if dt else None

class LoginView(APIView):
    authentication_classes = [] # Блокер 5
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        try:
            user = User.objects.get_by_natural_key(email)
        except User.DoesNotExist:
            # ИСПРАВЛЕНИЕ: возвращаем Response напрямую, без raise
            return Response(
                {"error": {"code": "INVALID_CREDENTIALS", "message": "Неверный email или пароль"}},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.check_password(password) or not user.is_active:
            # ИСПРАВЛЕНИЕ: также возвращаем Response напрямую
            return Response(
                {"error": {"code": "INVALID_CREDENTIALS", "message": "Неверный email или пароль"}},
                status=status.HTTP_401_UNAUTHORIZED
            )

        token = AccessToken.for_user(user) # Блокер: используем AccessToken
        
        # Считаем expiresIn из настроек
        lifetime = settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME', timedelta(minutes=60))
        
        return Response({
            "accessToken": str(token),
            "tokenType": "Bearer",
            "expiresIn": int(lifetime.total_seconds()),
            "user": {
                "id": str(user.id),
                "email": user.email,
                "fullName": user.full_name
            }
        })

class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            if 'email' in serializer.errors and "уже существует" in str(serializer.errors['email']):
                raise EmailAlreadyExists()
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Проверьте данные", "details": {"fields": serializer.errors}}}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        full_name = serializer.validated_data['fullName']

        user = User.objects.create_user(email=email, password=password, full_name=full_name)

        return Response({
            "user": {
                "id": str(user.id),
                "email": user.email,
                "fullName": user.full_name,
                "createdAt": to_utc_iso(user.created_at)
            }
        }, status=status.HTTP_201_CREATED)

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": str(user.id),
            "email": user.email,
            "fullName": user.full_name,
            "createdAt": to_utc_iso(user.created_at) # Исправлен формат
        })

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.auth
        jti_uuid = uuid.UUID(token["jti"])
        RevokedToken.objects.get_or_create(
            jti=jti_uuid,
            defaults={
                'user': request.user,
                'expires_at': datetime.fromtimestamp(token['exp'], tz=timezone.utc)
            }
        )
        return Response(status=status.HTTP_204_NO_CONTENT)