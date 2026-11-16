from rest_framework.views import exception_handler
from rest_framework import status

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        custom_data = {
            "error": {
                "code": "ERROR",
                "message": "Произошла ошибка",
                "details": response.data
            }
        }

        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            custom_data["error"]["code"] = "UNAUTHORIZED"
            custom_data["error"]["message"] = "Требуется авторизация"
        
        elif response.status_code == status.HTTP_400_BAD_REQUEST:
            custom_data["error"]["code"] = "VALIDATION_ERROR"
            custom_data["error"]["message"] = "Проверьте введённые данные"
            
            if isinstance(response.data, dict):
                fields = {}
                for field, errors in response.data.items():
                    fields[field] = errors[0] if isinstance(errors, list) else errors
                custom_data["error"]["details"] = {"fields": fields}
                
        elif response.status_code == status.HTTP_409_CONFLICT:
            custom_data["error"]["code"] = "EMAIL_ALREADY_EXISTS"
            custom_data["error"]["message"] = "Пользователь с таким email уже существует"
            custom_data["error"]["details"] = {}

        response.data = custom_data

    return response