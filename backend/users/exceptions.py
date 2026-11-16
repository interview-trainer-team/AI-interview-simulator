from rest_framework.views import exception_handler
from rest_framework import status
from rest_framework.exceptions import APIException

class EmailAlreadyExists(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = 'EMAIL_ALREADY_EXISTS'
    default_detail = 'Пользователь с таким email уже существует'

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        code = getattr(exc, 'default_code', 'ERROR')
        message = getattr(exc, 'default_detail', 'Произошла ошибка')
        
        details = response.data
        
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            code = "UNAUTHORIZED"
            message = "Требуется авторизация"
            details = {} 
        elif response.status_code == status.HTTP_400_BAD_REQUEST:
            code = "VALIDATION_ERROR"
            message = "Проверьте введённые данные" # Текст из контракта
            if isinstance(response.data, dict):
                fields = {}
                for field, errors in response.data.items():
                    fields[field] = errors[0] if isinstance(errors, list) else errors
                details = {"fields": fields}
        elif response.status_code == status.HTTP_409_CONFLICT:
            details = {} # Для 409 пустой details

        response.data = {
            "error": {
                "code": code,
                "message": message,
                "details": details
            }
        }
    return response