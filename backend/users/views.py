import uuid
from datetime import datetime, timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import LoginSerializer, RegisterSerializer
from .models import RevokedToken

User = get_user_model()

class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        try:
            user = User.objects.get_by_natural_key(email)
        except User.DoesNotExist:
            return Response({"detail": "Неверный email или пароль"}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            return Response({"detail": "Неверный email или пароль"}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        return Response({
            "accessToken": str(refresh.access_token),
            "tokenType": "Bearer",
            "expiresIn": 3600,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "fullName": user.full_name
            }
        })

class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            if 'email' in serializer.errors:
                return Response({"detail": "Пользователь с таким email уже существует"}, status=status.HTTP_409_CONFLICT)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        full_name = serializer.validated_data['fullName']

        user = User.objects.create_user(
            email=email,
            password=password,
            full_name=full_name
        )

        # По контракту регистрация НЕ выдает токены
        return Response({
            "user": {
                "id": str(user.id),
                "email": user.email,
                "fullName": user.full_name
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
            "createdAt": user.created_at.isoformat()
        })

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.auth
        try:
            jti_uuid = uuid.UUID(token["jti"])
            RevokedToken.objects.get_or_create(
                jti=jti_uuid,
                defaults={
                    'user': request.user,
                    'expires_at': datetime.fromtimestamp(token['exp'], tz=timezone.utc)
                }
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)