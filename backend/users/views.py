from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated 
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from .serializers import LoginSerializer, RegisterSerializer
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from .models import RevokedToken 
from datetime import datetime, timezone


User = get_user_model()

class LoginView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            # Если настроен глобальный обработчик, он сам отформатирует это
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        user = User.objects.filter(email=email).first()
        
        if user is None or not user.check_password(password):
            return Response(
                {"code": "INVALID_CREDENTIALS", "message": "Неверный email или пароль"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            "accessToken": str(refresh.access_token),
            "refreshToken": str(refresh), # <-- Важно для Logout!
            "tokenType": "Bearer",
            "expiresIn": 3600,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "fullName": f"{user.first_name} {user.last_name}".strip() or user.email
            }
        }, status=status.HTTP_200_OK)


class RegisterView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        full_name = serializer.validated_data.get('fullName', '')

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=full_name
        )

        refresh = RefreshToken.for_user(user)
        return Response({
            "accessToken": str(refresh.access_token),
            "refreshToken": str(refresh), # <-- Важно для Logout!
            "tokenType": "Bearer",
            "expiresIn": 3600,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "fullName": user.first_name
            }
        }, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Ваня требовал возвращать createdAt (дату создания)
        created_at = user.date_joined.isoformat() if hasattr(user, 'date_joined') else None
        
        return Response({
            "id": str(user.id),
            "email": user.email,
            "fullName": user.get_full_name() or user.first_name,
            "createdAt": created_at
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # request.auth содержит распакованный токен
        token = request.auth
        jti = token['jti']
        # Переводим unix timestamp в понятную дату
        expires_at = datetime.fromtimestamp(token['exp'], tz=timezone.utc)
        user_id = request.user.id

        # get_or_create защищает от ошибки 500, если токен уже в черном списке
        RevokedToken.objects.get_or_create(
            jti=jti,
            defaults={'user_id': user_id, 'expires_at': expires_at}
        )

        return Response(status=status.HTTP_204_NO_CONTENT)