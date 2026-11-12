from rest_framework.response import Response
from rest_framework.views import APIView


def error_response(code, message, http_status, details=None):
    """Единый формат ошибок из API-контракта (docs/api.md)."""
    body = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return Response(body, status=http_status)


class ApiError(Exception):
    """Ошибка API в формате из docs/api.md: {"error": {"code", "message", "details"}}.

    Её можно бросить из любого места view, ответ соберёт ApiView.
    """

    def __init__(self, code, message, status, details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details


class ApiView(APIView):
    """Базовый view: превращает ApiError в ответ нужного формата.

    Не зависит от глобального EXCEPTION_HANDLER в настройках.
    """

    def handle_exception(self, exc):
        if isinstance(exc, ApiError):
            return error_response(exc.code, exc.message, exc.status, exc.details)
        return super().handle_exception(exc)