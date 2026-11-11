from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        # Приводим все ошибки к единому формату
        error_data = {
            "error": {
                "code": "UNAUTHORIZED" if response.status_code == 401 else "ERROR",
                "message": "Требуется авторизация" if response.status_code == 401 else str(exc),
                "details": response.data
            }
        }
        response.data = error_data
    return response