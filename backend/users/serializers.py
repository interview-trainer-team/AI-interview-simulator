from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True, error_messages={'blank': 'Заполните все поля', 'required': 'Заполните все поля'})
    password = serializers.CharField(write_only=True, required=True, error_messages={'blank': 'Заполните все поля', 'required': 'Заполните все поля'})

    def validate_email(self, value):
        return value.strip().lower() # Очистка от пробелов и нижний регистр


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True, error_messages={'blank': 'Заполните все поля', 'required': 'Заполните все поля'})
    password = serializers.CharField(write_only=True, required=True, min_length=8, error_messages={
        'blank': 'Заполните все поля', 
        'required': 'Заполните все поля',
        'min_length': 'Пароль должен быть не менее 8 символов'
    })
    fullName = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Пользователь с таким email уже существует")
        return value