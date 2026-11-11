from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import RevokedToken # Импортируем модель

class CustomJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        
        if result is not None:
            user, token = result
            
            if not user.is_active:
                raise AuthenticationFailed("Пользователь удален или заблокирован")
                
            # Проверяем, есть ли jti этого токена в таблице отозванных
            if RevokedToken.objects.filter(jti=token['jti']).exists():
                raise AuthenticationFailed("Токен отозван или недействителен")
                
        return result