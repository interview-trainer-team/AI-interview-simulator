import re
from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True, error_messages={'blank': 'Заполните все поля', 'required': 'Заполните все поля'})
    password = serializers.CharField(write_only=True, required=True, error_messages={'blank': 'Заполните все поля', 'required': 'Заполните все поля'})

class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)
    fullName = serializers.CharField(required=True, min_length=2, max_length=150, trim_whitespace=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Пользователь с таким email уже существует")
        return value

    def validate_password(self, value):
        if len(value) < 8 or len(value) > 30:
            raise serializers.ValidationError("Пароль должен быть от 8 до 30 символов")
        if not re.search(r'[A-Z]', value) or not re.search(r'[a-z]', value):
            raise serializers.ValidationError("Пароль должен содержать заглавные и строчные латинские буквы")
        if not re.search(r'\d', value):
            raise serializers.ValidationError("Пароль должен содержать хотя бы одну цифру")
        return value