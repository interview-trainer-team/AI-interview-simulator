from rest_framework import serializers

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True, error_messages={'blank': 'Заполните все поля', 'required': 'Заполните все поля'})
    password = serializers.CharField(write_only=True, required=True, error_messages={'blank': 'Заполните все поля', 'required': 'Заполните все поля'})

    def validate_email(self, value):
        return value.strip().lower() # Очистка от пробелов и нижний регистр