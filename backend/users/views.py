import uuid
from datetime import datetime, timezone
from django.db import IntegrityError, transaction
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from .serializers import LoginSerializer, RegisterSerializer
from .models import RevokedToken
from .exceptions import EmailAlreadyExists
from interviews.services import to_utc_iso 
from django.utils import timezone as dj_timezone

User = get_user_model()

class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        try:
            user = User.objects.get_by_natural_key(email.lower())
        except User.DoesNotExist:
            return Response({"error": {"code": "INVALID_CREDENTIALS", "message": "Неверный email или пароль"}}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password) or not user.is_active:
            return Response({"error": {"code": "INVALID_CREDENTIALS", "message": "Неверный email или пароль"}}, status=status.HTTP_401_UNAUTHORIZED)

        token = AccessToken.for_user(user)
        lifetime = settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME')
        
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
        serializer.is_valid(raise_exception=True) # Если ошибка валидации, её поймает exceptions.py

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        full_name = serializer.validated_data['fullName']

        try:
            # Защита от гонки (race condition)
            with transaction.atomic():
                user = User.objects.create_user(email=email, password=password, full_name=full_name)
        except IntegrityError:
            raise EmailAlreadyExists()

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
            "createdAt": to_utc_iso(user.created_at)
        })
        
    def patch(self, request):
        from .serializers import UpdateProfileSerializer
        serializer = UpdateProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        user.full_name = serializer.validated_data['fullName']
        user.save()
        
        return Response({
            "id": str(user.id),
            "email": user.email,
            "fullName": user.full_name,
            "createdAt": to_utc_iso(user.created_at)
        }, status=status.HTTP_200_OK)

    def delete(self, request):
        password = request.data.get('password')
        if not password or not request.user.check_password(password):
            return Response(
                {"error": {"code": "INVALID_PASSWORD", "message": "Неверный пароль", "details": {"fields": {"password": "Неверный пароль"}}}},
                status=status.HTTP_400_BAD_REQUEST
            )
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

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
    


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        from .serializers import ChangePasswordSerializer
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data['current_password']):
            return Response(
                {"error": {"code": "INVALID_CURRENT_PASSWORD", "message": "Неверный текущий пароль", "details": {"fields": {"current_password": "Неверный пароль"}}}},
                status=status.HTTP_400_BAD_REQUEST
            )

        new_password = serializer.validated_data['new_password']
        if user.check_password(new_password):
            return Response(
                {"error": {"code": "SAME_PASSWORD", "message": "Новый пароль совпадает со старым", "details": {"fields": {"new_password": "Введите другой пароль"}}}},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.password_changed_at = dj_timezone.now() # Обновляем время смены пароля!
        user.save()

        # Выдаем новый токен, так как старый теперь невалиден
        token = AccessToken.for_user(user)
        return Response({
            "accessToken": str(token),
            "tokenType": "Bearer",
            "expiresIn": int(settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME').total_seconds())
        }, status=status.HTTP_200_OK)