import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from .feedback import level_verdict_for
from .llm import LLMError
from .models import AnalysisStatus, Answer, InterviewFeedback, InterviewStatus
from .tests_api import INTERVIEWS_URL
from .tests_flow import FlowTestCase, analysis_data

User = get_user_model()


def feedback_data(**changes):
    data = {
        "summary": "Хорошо знаете основы, но не приводите примеры.",
        "strongTopics": ["Типы данных"],
        "weakTopics": ["Работа с БД"],
        "recommendations": ["Разберите транзакции и индексы в SQL"],
    }
    data.update(changes)
    return data


def feedback_body(verdict="MATCH"):
    return {
        "status": "DONE",
        "summary": "Хорошо знаете основы, но не приводите примеры.",
        "strongTopics": ["Типы данных"],
        "weakTopics": ["Работа с БД"],
        "recommendations": ["Разберите транзакции и индексы в SQL"],
        "levelVerdict": verdict,
    }


EMPTY_FEEDBACK = {
    "summary": None,
    "strongTopics": None,
    "weakTopics": None,
    "recommendations": None,
    "levelVerdict": None,
}


class ResultsTestCase(FlowTestCase):
    def complete_url(self):
        return f"{self.base}/complete"

    def results(self):
        return self.client.get(f"{self.base}/results")

    def retry_feedback(self):
        return self.client.post(f"{self.base}/feedback/retry")

    def complete(self):
        return self.client.post(self.complete_url())

    def finish_all(self, *feedback, scores=(8, 7, 6, 9, 10)):
        """Пять ответов и автозавершение; последним в LLM уходит запрос рекомендаций."""
        self.use_llm(*[analysis_data(score) for score in scores], *feedback)
        return self.answer_n(5)

    def finish_early(self, *feedback, scores=(8, 7)):
        """Ответы на первые вопросы и досрочное завершение."""
        self.use_llm(*[analysis_data(score) for score in scores], *feedback)
        self.answer_n(len(scores))
        return self.complete()

    def feedback_row(self):
        return InterviewFeedback.objects.get(interview=self.interview)


class LevelVerdictTests(FlowTestCase):
    def test_thresholds(self):
        cases = [
            ("10.0", "MATCH"),
            ("7.5", "MATCH"),
            ("7.4", "PARTIAL"),
            ("5.0", "PARTIAL"),
            ("4.9", "BELOW"),
            ("0.0", "BELOW"),
        ]
        for score, verdict in cases:
            self.assertEqual(level_verdict_for(Decimal(score)), verdict, msg=score)
        self.assertIsNone(level_verdict_for(None))


class AutoCompletionFeedbackTests(ResultsTestCase):
    def test_fifth_answer_creates_feedback(self):
        responses = self.finish_all(feedback_data())
        last = responses[4]
        self.assertEqual(last.status_code, 201)
        self.assertEqual(last.data["interviewStatus"], "COMPLETED")

        feedback = self.feedback_row()
        self.assertEqual(feedback.status, AnalysisStatus.DONE)
        self.assertEqual(feedback.summary, "Хорошо знаете основы, но не приводите примеры.")
        self.assertEqual(feedback.strong_topics, ["Типы данных"])
        self.assertEqual(feedback.weak_topics, ["Работа с БД"])
        self.assertEqual(feedback.recommendations, ["Разберите транзакции и индексы в SQL"])
        self.assertEqual(feedback.level_verdict, "MATCH")  # среднее 8.0

    def test_partial_verdict_for_average_6(self):
        self.finish_all(feedback_data(), scores=(6, 6, 6, 6, 6))
        self.assertEqual(self.feedback_row().level_verdict, "PARTIAL")

    def test_below_verdict_for_average_4(self):
        self.finish_all(feedback_data(), scores=(4, 4, 4, 4, 4))
        self.assertEqual(self.feedback_row().level_verdict, "BELOW")

    def test_prompt_contains_answers_and_scores(self):
        fake = self.use_llm(*[analysis_data(8)] * 5, feedback_data())
        prompts = []
        original = fake.complete_json

        def recording(system_prompt, user_prompt):
            prompts.append(user_prompt)
            return original(system_prompt, user_prompt)

        fake.complete_json = recording
        self.answer_n_texts(["первый ответ", "второй", "третий", "четвёртый", "пятый"])
        feedback_prompt = prompts[-1]
        self.assertIn("Backend-разработка (Python)", feedback_prompt)
        self.assertIn("Junior", feedback_prompt)
        self.assertIn("Итоговый балл: 8.0", feedback_prompt)
        self.assertIn("первый ответ", feedback_prompt)
        self.assertIn("пятый", feedback_prompt)
        self.assertEqual(feedback_prompt.count("Оценка: 8 из 10"), 5)

    def answer_n_texts(self, texts):
        return [self.answer(text) for text in texts]

    def test_llm_failure_marks_feedback_failed_but_interview_stays_completed(self):
        responses = self.finish_all(LLMError("таймаут"))
        self.assertEqual(responses[4].status_code, 201)
        self.assertEqual(responses[4].data["interviewStatus"], "COMPLETED")
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.status, InterviewStatus.COMPLETED)
        feedback = self.feedback_row()
        self.assertEqual(feedback.status, AnalysisStatus.FAILED)
        self.assertIsNone(feedback.level_verdict)

    def test_invalid_schema_marks_feedback_failed_after_single_attempt(self):
        fake = self.use_llm(*[analysis_data(8)] * 5, feedback_data(summary=""))
        self.answer_n(5)
        self.assertEqual(self.feedback_row().status, AnalysisStatus.FAILED)
        self.assertEqual(fake.calls, 6)  # пять разборов и одна попытка рекомендаций

    def test_retry_of_last_failed_answer_also_creates_feedback(self):
        self.use_llm(*[analysis_data(8)] * 4, LLMError("а"), LLMError("б"))
        failed_id = self.answer_n(5)[4].data["answerId"]
        self.assertFalse(InterviewFeedback.objects.exists())
        self.use_llm(analysis_data(8), feedback_data())
        response = self.retry(failed_id)
        self.assertEqual(response.data["interviewStatus"], "COMPLETED")
        self.assertEqual(self.feedback_row().status, AnalysisStatus.DONE)
        self.assertEqual(self.feedback_row().level_verdict, "MATCH")


class CompleteTests(ResultsTestCase):
    def test_early_completion(self):
        response = self.finish_early(feedback_data())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "id": str(self.interview.id),
                "status": "COMPLETED",
                "finishedEarly": True,
                "totalScore": 7.5,  # (8 + 7) / 2
            },
        )
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.status, InterviewStatus.COMPLETED)
        self.assertTrue(self.interview.finished_early)
        self.assertIsNotNone(self.interview.completed_at)
        self.assertEqual(self.interview.total_score, Decimal("7.5"))
        feedback = self.feedback_row()
        self.assertEqual(feedback.status, AnalysisStatus.DONE)
        self.assertEqual(feedback.level_verdict, "MATCH")

    def test_total_score_is_rounded_half_up_to_one_decimal(self):
        response = self.finish_early(feedback_data(), scores=(8, 7, 7))
        self.assertEqual(response.data["totalScore"], 7.3)

    def test_without_answers_returns_no_answers(self):
        response = self.complete()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "NO_ANSWERS")
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.status, InterviewStatus.CREATED)
        self.assertFalse(InterviewFeedback.objects.exists())

    def test_started_interview_without_answers_returns_no_answers(self):
        self.current()
        response = self.complete()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "NO_ANSWERS")

    def test_failed_answers_block_completion(self):
        self.use_llm(analysis_data(8), LLMError("а"), LLMError("б"))
        first = self.answer().data["answerId"]
        failed = self.answer().data["answerId"]
        response = self.complete()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "ANALYSIS_FAILED")
        self.assertEqual(response.data["error"]["details"]["failedAnswerIds"], [failed])
        self.assertNotEqual(first, failed)
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.status, InterviewStatus.IN_PROGRESS)

        # После повтора анализа завершение проходит
        self.use_llm(analysis_data(6), feedback_data())
        self.assertEqual(self.retry(failed).data["analysisStatus"], "DONE")
        self.assertEqual(self.complete().status_code, 200)

    def test_fresh_pending_answer_blocks_completion(self):
        self.use_llm(analysis_data(8))
        self.answer()
        Answer.objects.create(interview_question=self.link(2), answer_text="анализируется")
        response = self.complete()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "ANALYSIS_PENDING")
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.status, InterviewStatus.IN_PROGRESS)

    def test_second_call_is_idempotent(self):
        first = self.finish_early(feedback_data())
        self.interview.refresh_from_db()
        completed_at = self.interview.completed_at
        fake = self.use_llm(feedback_data())
        second = self.complete()
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.data, first.data)
        self.assertEqual(fake.calls, 0)
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.completed_at, completed_at)

    def test_completing_auto_completed_interview_returns_current_data(self):
        self.finish_all(feedback_data())
        response = self.complete()
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["finishedEarly"])  # завершено автоматически, не досрочно
        self.assertEqual(response.data["totalScore"], 8.0)

    def test_feedback_failure_does_not_undo_completion(self):
        response = self.finish_early(LLMError("таймаут"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "COMPLETED")
        self.assertEqual(self.feedback_row().status, AnalysisStatus.FAILED)

    def test_after_completion_flow_endpoints_are_closed(self):
        self.finish_early(feedback_data())
        current = self.current()
        self.assertEqual(current.status_code, 409)
        self.assertEqual(current.data["error"]["code"], "INTERVIEW_COMPLETED")
        answer = self.client.post(
            f"{self.base}/answers",
            {"questionId": str(self.link(3).question_id), "answerText": "поздно"},
            format="json",
        )
        self.assertEqual(answer.status_code, 409)
        self.assertEqual(answer.data["error"]["code"], "INTERVIEW_COMPLETED")


class ResultsTests(ResultsTestCase):
    def test_not_completed_returns_409(self):
        for prepare in (lambda: None, self.current):
            prepare()
            response = self.results()
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.data["error"]["code"], "INTERVIEW_NOT_COMPLETED")

    def test_full_interview_results(self):
        self.finish_all(feedback_data())
        response = self.results()
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data["id"], str(self.interview.id))
        self.assertEqual(data["directionName"], "Backend-разработка (Python)")
        self.assertEqual(data["levelName"], "Junior")
        self.assertFalse(data["finishedEarly"])
        self.assertTrue(data["completedAt"].endswith("Z"))
        self.assertEqual(data["totalScore"], 8.0)
        self.assertEqual(data["feedback"], feedback_body("MATCH"))

        self.assertEqual([item["position"] for item in data["items"]], [1, 2, 3, 4, 5])
        self.assertEqual([item["score"] for item in data["items"]], [8, 7, 6, 9, 10])
        first = data["items"][0]
        self.assertEqual(first["questionText"], self.link(1).question.text)
        self.assertEqual(first["answerText"], "Мой ответ")
        self.assertEqual(first["criteria"], {"accuracy": 9, "completeness": 7, "clarity": 8})
        self.assertEqual(first["strengths"], ["Верно названо главное отличие"])
        self.assertEqual(first["weaknesses"], ["Нет примера использования"])
        self.assertEqual(first["recommendation"], "Добавьте пример, когда кортеж удобнее списка")

    def test_early_completion_shows_unanswered_questions_without_answer(self):
        self.finish_early(feedback_data())
        data = self.results().data
        self.assertTrue(data["finishedEarly"])
        self.assertEqual(len(data["items"]), 5)
        self.assertEqual([item["score"] for item in data["items"]], [8, 7, None, None, None])
        for item in data["items"][2:]:
            self.assertIsNone(item["answerText"])
            self.assertIsNone(item["criteria"])
            self.assertIsNone(item["recommendation"])
            self.assertEqual(item["strengths"], [])
            self.assertEqual(item["weaknesses"], [])
            self.assertTrue(item["questionText"])

    def test_failed_feedback_has_null_fields(self):
        self.finish_all(LLMError("таймаут"))
        data = self.results().data
        self.assertEqual(data["feedback"], {"status": "FAILED", **EMPTY_FEEDBACK})
        self.assertEqual(len(data["items"]), 5)  # остальное доступно

    def test_fresh_pending_feedback_is_reported_as_pending(self):
        self.finish_all(feedback_data())
        InterviewFeedback.objects.filter(interview=self.interview).update(
            status=AnalysisStatus.PENDING, created_at=timezone.now()
        )
        self.assertEqual(self.results().data["feedback"], {"status": "PENDING", **EMPTY_FEEDBACK})

    def test_stale_pending_feedback_becomes_failed(self):
        self.finish_all(feedback_data())
        InterviewFeedback.objects.filter(interview=self.interview).update(
            status=AnalysisStatus.PENDING, created_at=timezone.now() - timedelta(minutes=3)
        )
        self.assertEqual(self.results().data["feedback"], {"status": "FAILED", **EMPTY_FEEDBACK})
        self.assertEqual(self.feedback_row().status, AnalysisStatus.FAILED)

    def test_missing_feedback_row_is_reported_as_failed(self):
        self.finish_all(feedback_data())
        InterviewFeedback.objects.all().delete()
        self.assertEqual(self.results().data["feedback"], {"status": "FAILED", **EMPTY_FEEDBACK})


class FeedbackRetryTests(ResultsTestCase):
    def test_not_completed_returns_409(self):
        response = self.retry_feedback()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "INTERVIEW_NOT_COMPLETED")

    def test_done_feedback_cannot_be_retried(self):
        self.finish_all(feedback_data())
        fake = self.use_llm(feedback_data())
        response = self.retry_feedback()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "FEEDBACK_NOT_FAILED")
        self.assertEqual(fake.calls, 0)

    def test_fresh_pending_feedback_cannot_be_retried(self):
        self.finish_all(feedback_data())
        InterviewFeedback.objects.filter(interview=self.interview).update(
            status=AnalysisStatus.PENDING, created_at=timezone.now()
        )
        response = self.retry_feedback()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "FEEDBACK_NOT_FAILED")

    def test_retry_after_failure_returns_feedback(self):
        self.finish_all(LLMError("таймаут"))
        self.use_llm(feedback_data())
        response = self.retry_feedback()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, feedback_body("MATCH"))
        self.assertEqual(self.feedback_row().status, AnalysisStatus.DONE)
        # Результаты теперь показывают готовые рекомендации
        self.assertEqual(self.results().data["feedback"], feedback_body("MATCH"))

    def test_retry_that_fails_again_returns_200_with_failed_status(self):
        self.finish_all(LLMError("а"))
        self.use_llm(LLMError("б"))
        response = self.retry_feedback()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"status": "FAILED", **EMPTY_FEEDBACK})
        # и можно повторить ещё раз
        self.use_llm(feedback_data())
        self.assertEqual(self.retry_feedback().data["status"], "DONE")

    def test_stale_pending_feedback_can_be_retried(self):
        self.finish_all(feedback_data())
        InterviewFeedback.objects.filter(interview=self.interview).update(
            status=AnalysisStatus.PENDING, created_at=timezone.now() - timedelta(minutes=3)
        )
        self.use_llm(feedback_data())
        response = self.retry_feedback()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "DONE")

    def test_missing_feedback_row_is_created_by_retry(self):
        self.finish_all(feedback_data())
        InterviewFeedback.objects.all().delete()
        self.use_llm(feedback_data())
        response = self.retry_feedback()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, feedback_body("MATCH"))
        self.assertEqual(InterviewFeedback.objects.count(), 1)


class AccessTests22(ResultsTestCase):
    def test_foreign_unknown_and_invalid_ids_return_same_404(self):
        other = User.objects.create_user(
            email="other@example.com", password="Secret123", full_name="Другой"
        )
        foreign = self.make_interview(user=other, status=InterviewStatus.COMPLETED)
        InterviewFeedback.objects.create(interview=foreign, status=AnalysisStatus.FAILED)
        bodies = []
        for interview_id in [foreign.id, uuid.uuid4(), "not-a-uuid"]:
            base = f"{INTERVIEWS_URL}/{interview_id}"
            responses = [
                self.client.post(f"{base}/complete"),
                self.client.get(f"{base}/results"),
                self.client.post(f"{base}/feedback/retry"),
            ]
            for response in responses:
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.data["error"]["code"], "INTERVIEW_NOT_FOUND")
            bodies.append(responses[1].data)
        self.assertEqual(bodies[0], bodies[1])
        self.assertEqual(
            InterviewFeedback.objects.get(interview=foreign).status, AnalysisStatus.FAILED
        )

    def test_requires_authentication(self):
        from rest_framework.test import APIClient

        anonymous = APIClient()
        for method, suffix in [("post", "complete"), ("get", "results"), ("post", "feedback/retry")]:
            response = getattr(anonymous, method)(f"{self.base}/{suffix}")
            self.assertIn(response.status_code, (401, 403))  # 401 появится вместе с JWT