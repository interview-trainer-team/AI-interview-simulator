from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

class CustomJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        # super().authenticate уже проверяет подпись, срок и блэклист
        result = super().authenticate(request)
        
        if result is not None:
            user, token = result
            
            # 4 проверка: пользователь существует и не удален
            if not user.is_active:
                raise AuthenticationFailed("Пользователь удален или заблокирован")
                
            # 5 проверка: время создания токена (iat) не раньше смены пароля.
            # В стандартной модели Django нет поля password_changed_at, 
            # поэтому эта проверка будет работать, когда Вика сделает кастомную модель (задача #11).
            
        return result