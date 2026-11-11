from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import LoginSerializer

User = get_user_model()

class LoginView(APIView):
    # Авторизация для этого метода не нужна
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        # 1. Валидация данных
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Заполните все поля",
                    "details": {"fields": serializer.errors}
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        # 2. Поиск пользователя и проверка пароля
        # Используем filter().first(), чтобы не было ошибки, если юзера нет
        user = User.objects.filter(email=email).first()
        
        if user is None or not user.check_password(password):
            # Одинаковый ответ для обоих случаев (безопасность)
            return Response({
                "error": {
                    "code": "INVALID_CREDENTIALS",
                    "message": "Неверный email или пароль"
                }
            }, status=status.HTTP_401_UNAUTHORIZED)

        # 3. Генерация JWT токена
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        # 4. Успешный ответ
        return Response({
            "accessToken": access_token,
            "tokenType": "Bearer",
            "expiresIn": 3600, # 60 минут в секундах
            "user": {
                "id": str(user.id),
                "email": user.email,
                # Берем имя и фамилию из стандартной модели Django, если они есть
                "fullName": f"{user.first_name} {user.last_name}".strip() or user.email
            }
        }, status=status.HTTP_200_OK)