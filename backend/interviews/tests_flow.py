import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone

from .llm import LLMError
from .models import AnalysisStatus, Answer, Interview, InterviewQuestion, InterviewStatus
from .services import pick_bank_questions
from .tests_api import CREATE_BODY, INTERVIEWS_URL, ApiTestCase

User = get_user_model()


def analysis_data(score=8, **changes):
    data = {
        "score": score,
        "criteria": {"accuracy": 9, "completeness": 7, "clarity": 8},
        "strengths": ["Верно названо главное отличие"],
        "weaknesses": ["Нет примера использования"],
        "recommendation": "Добавьте пример, когда кортеж удобнее списка",
    }
    data.update(changes)
    return data


class FakeLLM:
    """Подставляется вместо реального клиента: отдаёт заготовленные ответы по очереди."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = 0

    def complete_json(self, system_prompt, user_prompt):
        self.calls += 1
        if not self.responses:
            raise LLMError("нет заготовленного ответа")
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


class FlowTestCase(ApiTestCase):
    def setUp(self):
        super().setUp()
        response = self.client.post(INTERVIEWS_URL, CREATE_BODY, format="json")
        self.interview = Interview.objects.get(id=response.data["id"])
        self.base = f"{INTERVIEWS_URL}/{self.interview.id}"

    def use_llm(self, *responses):
        fake = FakeLLM(*responses)
        patcher = patch("interviews.analysis.get_llm_client", return_value=fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        return fake

    def current(self):
        return self.client.get(f"{self.base}/questions/current")

    def answer(self, text="Мой ответ", question_id=None):
        if question_id is None:
            question_id = self.current().data["questionId"]
        return self.client.post(
            f"{self.base}/answers", {"questionId": question_id, "answerText": text}, format="json"
        )

    def retry(self, answer_id):
        return self.client.post(f"{self.base}/answers/{answer_id}/retry")

    def answer_n(self, count):
        """Отвечает на первые count вопросов (LLM должна быть подготовлена через use_llm)."""
        return [self.answer() for _ in range(count)]

    def link(self, position):
        return self.interview.interview_questions.get(position=position)


class AccessTests(FlowTestCase):
    def test_foreign_unknown_and_invalid_ids_all_return_same_404(self):
        other = User.objects.create_user(
            email="other@example.com", password="Secret123", full_name="Другой"
        )
        foreign = self.make_interview(user=other)
        body = {"questionId": str(uuid.uuid4()), "answerText": "текст"}
        bodies = []
        for interview_id in [foreign.id, uuid.uuid4(), "not-a-uuid"]:
            base = f"{INTERVIEWS_URL}/{interview_id}"
            responses = [
                self.client.get(base),
                self.client.get(f"{base}/questions/current"),
                self.client.post(f"{base}/answers", body, format="json"),
                self.client.post(f"{base}/answers/{uuid.uuid4()}/retry"),
            ]
            for response in responses:
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.data["error"]["code"], "INTERVIEW_NOT_FOUND")
            bodies.append(responses[0].data)
        self.assertEqual(bodies[0], bodies[1])  # чужое неотличимо от несуществующего
        self.assertFalse(Answer.objects.exists())
        foreign.refresh_from_db()
        self.assertEqual(foreign.status, InterviewStatus.CREATED)


class DetailTests(FlowTestCase):
    def test_returns_header_data(self):
        response = self.client.get(self.base)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "id": str(self.interview.id),
                "status": "CREATED",
                "directionName": "Backend-разработка (Python)",
                "levelName": "Junior",
                "totalQuestions": 5,
                "answeredCount": 0,
            },
        )

    def test_answered_count_grows(self):
        self.use_llm(analysis_data())
        self.answer()
        response = self.client.get(self.base)
        self.assertEqual(response.data["answeredCount"], 1)
        self.assertEqual(response.data["status"], "IN_PROGRESS")


class CurrentQuestionTests(FlowTestCase):
    def test_first_call_starts_interview_and_returns_first_question(self):
        response = self.current()
        self.assertEqual(response.status_code, 200)
        first = self.link(1)
        self.assertEqual(
            response.data,
            {
                "position": 1,
                "totalQuestions": 5,
                "questionId": str(first.question_id),
                "text": first.question.text,
            },
        )
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.status, InterviewStatus.IN_PROGRESS)
        self.assertIsNotNone(self.interview.started_at)

    def test_repeated_call_returns_same_question_and_keeps_started_at(self):
        first = self.current()
        self.interview.refresh_from_db()
        started_at = self.interview.started_at
        second = self.current()
        self.assertEqual(first.data, second.data)
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.started_at, started_at)

    def test_questions_go_in_order_after_answers(self):
        self.use_llm(*[analysis_data()] * 3)
        positions = []
        for _ in range(3):
            positions.append(self.current().data["position"])
            self.answer()
        positions.append(self.current().data["position"])
        self.assertEqual(positions, [1, 2, 3, 4])

    def test_completed_interview_returns_409(self):
        self.interview.status = InterviewStatus.COMPLETED
        self.interview.save()
        response = self.current()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "INTERVIEW_COMPLETED")

    def test_failed_analysis_blocks_when_all_questions_answered(self):
        self.use_llm(*[analysis_data()] * 4, LLMError("а"), LLMError("б"))
        responses = self.answer_n(5)
        failed_id = responses[4].data["answerId"]
        response = self.current()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "ANALYSIS_FAILED")
        self.assertEqual(response.data["error"]["details"]["failedAnswerIds"], [failed_id])

    def test_fresh_pending_answer_returns_analysis_pending(self):
        self.use_llm(*[analysis_data()] * 4)
        self.answer_n(4)
        self.current()
        Answer.objects.create(
            interview_question=self.link(5), answer_text="ещё анализируется"
        )  # статус PENDING по умолчанию
        response = self.current()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "ANALYSIS_PENDING")


class AnswerTests(FlowTestCase):
    def test_saves_answer_and_returns_analysis(self):
        fake = self.use_llm(analysis_data(8))
        question_id = self.current().data["questionId"]
        response = self.answer("  Список изменяемый, кортеж нет  ", question_id)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["analysisStatus"], "DONE")
        self.assertEqual(response.data["analysis"], analysis_data(8))
        self.assertEqual(response.data["interviewStatus"], "IN_PROGRESS")
        self.assertEqual(response.data["nextPosition"], 2)
        self.assertEqual(fake.calls, 1)

        answer = Answer.objects.get(id=response.data["answerId"])
        self.assertEqual(answer.answer_text, "Список изменяемый, кортеж нет")
        self.assertEqual(answer.analysis_status, AnalysisStatus.DONE)
        self.assertEqual(answer.score, 8)
        self.assertEqual(answer.analysis_attempts, 1)
        self.assertIsNotNone(answer.analyzed_at)
        self.assertEqual(str(answer.interview_question.question_id), question_id)

    def test_llm_failure_keeps_answer_as_failed(self):
        fake = self.use_llm(LLMError("таймаут"), LLMError("снова таймаут"))
        response = self.answer("Мой ответ")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["analysisStatus"], "FAILED")
        self.assertIsNone(response.data["analysis"])
        self.assertEqual(response.data["nextPosition"], 2)
        self.assertEqual(fake.calls, 2)  # первая попытка и один повтор
        answer = Answer.objects.get(id=response.data["answerId"])
        self.assertEqual(answer.analysis_status, AnalysisStatus.FAILED)
        self.assertEqual(answer.answer_text, "Мой ответ")
        self.assertEqual(answer.analysis_attempts, 2)

    def test_invalid_llm_schema_is_retried_once(self):
        fake = self.use_llm(analysis_data(score=99), analysis_data(score=7))
        response = self.answer()
        self.assertEqual(response.data["analysisStatus"], "DONE")
        self.assertEqual(response.data["analysis"]["score"], 7)
        self.assertEqual(fake.calls, 2)

    def test_validation_errors(self):
        self.use_llm(analysis_data())
        question_id = self.current().data["questionId"]
        cases = [
            ({"questionId": question_id, "answerText": ""}, "answerText"),
            ({"questionId": question_id, "answerText": "   "}, "answerText"),
            ({"questionId": question_id}, "answerText"),
            ({"questionId": question_id, "answerText": 123}, "answerText"),
            ({"questionId": question_id, "answerText": "я" * 4001}, "answerText"),
            ({"answerText": "текст"}, "questionId"),
            ({"questionId": "not-a-uuid", "answerText": "текст"}, "questionId"),
        ]
        for body, field in cases:
            response = self.client.post(f"{self.base}/answers", body, format="json")
            self.assertEqual(response.status_code, 400, msg=body)
            self.assertEqual(response.data["error"]["code"], "VALIDATION_ERROR")
            self.assertIn(field, response.data["error"]["details"]["fields"])
        self.assertFalse(Answer.objects.exists())

    def test_answer_of_exactly_4000_characters_is_accepted(self):
        self.use_llm(analysis_data())
        response = self.answer("я" * 4000)
        self.assertEqual(response.status_code, 201)

    def test_only_current_question_can_be_answered(self):
        self.use_llm(analysis_data(), analysis_data())
        self.current()
        later = str(self.link(3).question_id)
        for question_id in [later, str(uuid.uuid4())]:
            response = self.answer(question_id=question_id)
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.data["error"]["code"], "NOT_CURRENT_QUESTION")
        self.assertFalse(Answer.objects.exists())

    def test_question_cannot_be_answered_twice(self):
        self.use_llm(analysis_data(), analysis_data())
        question_id = self.current().data["questionId"]
        self.assertEqual(self.answer(question_id=question_id).status_code, 201)
        second = self.answer(question_id=question_id)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.data["error"]["code"], "NOT_CURRENT_QUESTION")
        self.assertEqual(Answer.objects.count(), 1)

    def test_answer_before_first_question_was_requested_is_rejected(self):
        response = self.answer(question_id=str(self.link(1).question_id))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "NOT_CURRENT_QUESTION")
        self.assertFalse(Answer.objects.exists())

    def test_completed_interview_rejects_answers(self):
        self.interview.status = InterviewStatus.COMPLETED
        self.interview.save()
        response = self.answer(question_id=str(self.link(1).question_id))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "INTERVIEW_COMPLETED")

    def test_fifth_answer_completes_interview(self):
        self.use_llm(*[analysis_data(score) for score in (8, 7, 6, 9, 10)])
        responses = self.answer_n(5)
        for response in responses[:4]:
            self.assertEqual(response.data["interviewStatus"], "IN_PROGRESS")
        last = responses[4]
        self.assertEqual(last.status_code, 201)
        self.assertEqual(last.data["interviewStatus"], "COMPLETED")
        self.assertIsNone(last.data["nextPosition"])

        self.interview.refresh_from_db()
        self.assertEqual(self.interview.status, InterviewStatus.COMPLETED)
        self.assertEqual(self.interview.total_score, Decimal("8.0"))
        self.assertFalse(self.interview.finished_early)
        self.assertIsNotNone(self.interview.completed_at)
        self.assertEqual(self.current().data["error"]["code"], "INTERVIEW_COMPLETED")

    def test_fifth_answer_with_failed_analysis_does_not_complete(self):
        self.use_llm(*[analysis_data()] * 4, LLMError("а"), LLMError("б"))
        last = self.answer_n(5)[4]
        self.assertEqual(last.data["analysisStatus"], "FAILED")
        self.assertEqual(last.data["interviewStatus"], "IN_PROGRESS")
        self.assertIsNone(last.data["nextPosition"])
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.status, InterviewStatus.IN_PROGRESS)
        self.assertIsNone(self.interview.total_score)


class RetryTests(FlowTestCase):
    def fail_last_of_five(self):
        """Пять ответов, пятый не проанализирован. Возвращает id пятого ответа."""
        self.use_llm(*[analysis_data(score) for score in (8, 7, 6, 9)], LLMError("а"), LLMError("б"))
        return self.answer_n(5)[4].data["answerId"]

    def test_retry_of_last_failed_answer_completes_interview(self):
        failed_id = self.fail_last_of_five()
        self.use_llm(analysis_data(10))
        response = self.retry(failed_id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["analysisStatus"], "DONE")
        self.assertEqual(response.data["analysis"]["score"], 10)
        self.assertEqual(response.data["interviewStatus"], "COMPLETED")
        self.assertIsNone(response.data["nextPosition"])

        answer = Answer.objects.get(id=failed_id)
        self.assertEqual(answer.analysis_attempts, 3)  # две попытки и повтор
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.total_score, Decimal("8.0"))

    def test_retry_of_middle_answer_keeps_interview_in_progress(self):
        self.use_llm(LLMError("а"), LLMError("б"))
        failed_id = self.answer().data["answerId"]
        self.use_llm(analysis_data(6))
        response = self.retry(failed_id)
        self.assertEqual(response.data["analysisStatus"], "DONE")
        self.assertEqual(response.data["interviewStatus"], "IN_PROGRESS")
        self.assertEqual(response.data["nextPosition"], 2)

    def test_retry_that_fails_again_returns_200_with_failed_status(self):
        failed_id = self.fail_last_of_five()
        self.use_llm(LLMError("а"), LLMError("б"))
        response = self.retry(failed_id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["analysisStatus"], "FAILED")
        self.assertIsNone(response.data["analysis"])
        self.assertEqual(response.data["interviewStatus"], "IN_PROGRESS")
        self.assertEqual(
            Answer.objects.get(id=failed_id).analysis_status, AnalysisStatus.FAILED
        )

    def test_retry_of_done_answer_is_rejected(self):
        self.use_llm(analysis_data())
        done_id = self.answer().data["answerId"]
        fake = self.use_llm(analysis_data())
        response = self.retry(done_id)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "ANALYSIS_NOT_FAILED")
        self.assertEqual(fake.calls, 0)

    def test_retry_of_fresh_pending_answer_is_rejected(self):
        self.current()
        pending = Answer.objects.create(interview_question=self.link(1), answer_text="анализируется")
        response = self.retry(pending.id)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "ANALYSIS_NOT_FAILED")

    def test_unknown_invalid_or_foreign_interview_answer_returns_404(self):
        self.use_llm(analysis_data())
        self.answer()
        # Ответ из другого интервью этого же пользователя
        second = self.make_interview(status=InterviewStatus.COMPLETED)
        links = InterviewQuestion.objects.bulk_create(
            [
                InterviewQuestion(interview=second, question=question, position=position)
                for position, question in enumerate(
                    pick_bank_questions(second.direction, second.level), start=1
                )
            ]
        )
        stranger = Answer.objects.create(
            interview_question=links[0],
            answer_text="чужой",
            analysis_status=AnalysisStatus.FAILED,
        )
        for answer_id in [uuid.uuid4(), "not-a-uuid", stranger.id]:
            response = self.retry(answer_id)
            self.assertEqual(response.status_code, 404, msg=answer_id)
            self.assertEqual(response.data["error"]["code"], "ANSWER_NOT_FOUND")
        stranger.refresh_from_db()
        self.assertEqual(stranger.analysis_status, AnalysisStatus.FAILED)

    def test_stale_pending_answer_becomes_failed_and_can_be_retried(self):
        self.use_llm(*[analysis_data(8)] * 4)
        self.answer_n(4)
        self.current()
        stuck = Answer.objects.create(interview_question=self.link(5), answer_text="зависший")
        Answer.objects.filter(id=stuck.id).update(created_at=timezone.now() - timedelta(minutes=3))

        response = self.current()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "ANALYSIS_FAILED")
        self.assertEqual(response.data["error"]["details"]["failedAnswerIds"], [str(stuck.id)])

        self.use_llm(analysis_data(8))
        retried = self.retry(stuck.id)
        self.assertEqual(retried.data["analysisStatus"], "DONE")
        self.assertEqual(retried.data["interviewStatus"], "COMPLETED")