import uuid
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import RevokedToken

class CustomJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        
        if result is not None:
            user, token = result
            
            if not user.is_active:
                raise AuthenticationFailed("Пользователь заблокирован")
                
            # Проверка нахождения в черном списке (jti хранится как UUID)
            try:
                jti_uuid = uuid.UUID(token["jti"])
                if RevokedToken.objects.filter(jti=jti_uuid).exists():
                    raise AuthenticationFailed("Токен отозван")
            except ValueError:
                raise AuthenticationFailed("Неверный формат токена")

            # Проверка, что токен выдан после смены пароля
            if hasattr(user, 'password_changed_at') and user.password_changed_at:
                token_iat = int(token["iat"])
                password_changed_ts = int(user.password_changed_at.timestamp())
                if token_iat < password_changed_ts:
                    raise AuthenticationFailed("Пароль был изменен, войдите заново")
                
        return result