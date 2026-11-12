"""Клиент LLM.

Работает с любым OpenAI-совместимым API (POST {LLM_BASE_URL}/chat/completions).
Настройки читаются из окружения (.env), в settings.py ничего добавлять не нужно:
  LLM_API_KEY          ключ провайдера (без него запрос не отправляется, ответ получит статус FAILED)
  LLM_BASE_URL         по умолчанию https://api.openai.com/v1
  LLM_MODEL            по умолчанию gpt-4o-mini
  LLM_TIMEOUT_SECONDS  по умолчанию 30
  LLM_PROVIDER=stub    заглушка для разработки: без ключа и без сети
Если команда выберет другого провайдера, достаточно заменить get_llm_client().
"""

import json
import logging
import os
import re
import urllib.request

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TIMEOUT_SECONDS = 30


class LLMError(Exception):
    """LLM недоступна, ответила с ошибкой или вернула не JSON."""


def parse_json_object(text):
    """Достаёт JSON-объект из текста ответа (модель может обернуть его в ```json ... ```)."""
    if not isinstance(text, str):
        raise LLMError("Ответ LLM не является текстом")
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        raise LLMError("В ответе LLM нет JSON-объекта")
    try:
        data = json.loads(cleaned[start : end + 1])
    except ValueError as exc:
        raise LLMError("Ответ LLM не разбирается как JSON") from exc
    if not isinstance(data, dict):
        raise LLMError("Ответ LLM не является JSON-объектом")
    return data


def _timeout():
    try:
        return int(os.getenv("LLM_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))
    except ValueError:
        return DEFAULT_TIMEOUT_SECONDS


class OpenAICompatibleClient:
    def complete_json(self, system_prompt, user_prompt):
        """Отправляет запрос и возвращает разобранный JSON-объект. Бросает LLMError."""
        api_key = os.getenv("LLM_API_KEY", "")
        if not api_key:
            raise LLMError("LLM_API_KEY не задан")

        url = os.getenv("LLM_BASE_URL", DEFAULT_BASE_URL).rstrip("/") + "/chat/completions"
        payload = {
            "model": os.getenv("LLM_MODEL", DEFAULT_MODEL),
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=_timeout()) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            content = body["choices"][0]["message"]["content"]
        except (OSError, ValueError, KeyError, IndexError, TypeError) as exc:
            # Сам ответ и ключ в лог не пишем: там могут быть данные пользователя
            logger.warning("Запрос к LLM не удался: %s", type(exc).__name__)
            raise LLMError("Запрос к LLM не удался") from exc
        return parse_json_object(content)


class StubLLMClient:
    """Заглушка для разработки (LLM_PROVIDER=stub): не ходит в сеть, оценка зависит от длины ответа."""

    def complete_json(self, system_prompt, user_prompt):
        if "summary" in system_prompt:  # итоговые рекомендации по интервью
            return {
                "summary": "Заглушка: итоги интервью.",
                "strongTopics": ["Основы"],
                "weakTopics": ["Практика"],
                "recommendations": ["Повторите основные темы."],
            }
        match = re.search(r"<answer>(.*)</answer>", user_prompt, re.DOTALL)
        length = len(match.group(1)) if match else 0
        score = min(10, 2 + length // 30)
        return {
            "score": score,
            "criteria": {"accuracy": score, "completeness": score, "clarity": score},
            "strengths": ["Заглушка: ответ получен"],
            "weaknesses": [] if score >= 8 else ["Заглушка: ответ можно сделать подробнее"],
            "recommendation": "Заглушка: добавьте пример и больше деталей.",
        }


def get_llm_client():
    if os.getenv("LLM_PROVIDER", "").lower() == "stub":
        return StubLLMClient()
    return OpenAICompatibleClient()