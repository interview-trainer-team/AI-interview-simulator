from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import (
    Answer,
    AnalysisStatus,
    Direction,
    Interview,
    InterviewFeedback,
    InterviewQuestion,
    InterviewStatus,
    Level,
    Question,
)

User = get_user_model()


class ReferenceDataTests(TestCase):
    def test_levels_and_direction_are_created_by_migration(self):
        self.assertEqual(set(Level.objects.values_list("code", flat=True)), {"junior", "middle"})
        self.assertTrue(Direction.objects.filter(code="backend_python", is_active=True).exists())


class BaseTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="Secret123", full_name="Иванов Иван"
        )
        self.direction = Direction.objects.get(code="backend_python")
        self.junior = Level.objects.get(code="junior")
        self.question = Question.objects.create(
            direction=self.direction, level=self.junior, text="Q1"
        )
        self.interview = Interview.objects.create(
            user=self.user, direction=self.direction, level=self.junior
        )


class InterviewModelTests(BaseTestCase):
    def test_new_interview_defaults(self):
        self.assertEqual(self.interview.status, InterviewStatus.CREATED)
        self.assertFalse(self.interview.finished_early)
        self.assertIsNone(self.interview.started_at)

    def test_invalid_status_is_rejected(self):
        with self.assertRaises(ValidationError):
            Interview(
                user=self.user, direction=self.direction, level=self.junior, status="DONE"
            ).full_clean()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Interview.objects.create(
                    user=self.user, direction=self.direction, level=self.junior, status="DONE"
                )

    def test_total_score_must_be_between_0_and_10(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Interview.objects.create(
                    user=self.user, direction=self.direction, level=self.junior, total_score=10.5
                )


class QuestionModelTests(BaseTestCase):
    def test_question_defaults(self):
        self.assertEqual(self.question.source, "BANK")
        self.assertTrue(self.question.is_active)
        self.assertIsNone(self.question.reference_answer)

    def test_unknown_source_is_rejected(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Question.objects.create(
                    direction=self.direction, level=self.junior, text="Q", source="OTHER"
                )


class InterviewQuestionTests(BaseTestCase):
    def test_question_is_unique_within_interview(self):
        InterviewQuestion.objects.create(
            interview=self.interview, question=self.question, position=1
        )
        other = Question.objects.create(direction=self.direction, level=self.junior, text="Q2")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                InterviewQuestion.objects.create(
                    interview=self.interview, question=self.question, position=2
                )
        with self.assertRaises(IntegrityError):  # позиция тоже уникальна
            with transaction.atomic():
                InterviewQuestion.objects.create(interview=self.interview, question=other, position=1)

    def test_position_must_be_between_1_and_5(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                InterviewQuestion.objects.create(
                    interview=self.interview, question=self.question, position=6
                )


class AnswerModelTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.iq = InterviewQuestion.objects.create(
            interview=self.interview, question=self.question, position=1
        )

    def test_answer_defaults(self):
        answer = Answer.objects.create(interview_question=self.iq, answer_text="Ответ")
        self.assertEqual(answer.analysis_status, AnalysisStatus.PENDING)
        self.assertEqual(answer.analysis_attempts, 0)
        self.assertEqual(answer.strengths, [])
        self.assertEqual(answer.criteria, {})
        self.assertEqual(answer.interview, self.interview)
        self.assertEqual(answer.question, self.question)

    def test_one_answer_per_question(self):
        Answer.objects.create(interview_question=self.iq, answer_text="Ответ")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Answer.objects.create(interview_question=self.iq, answer_text="Ещё")

    def test_score_must_be_between_0_and_10(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Answer.objects.create(interview_question=self.iq, answer_text="x", score=11)
        with self.assertRaises(ValidationError):
            Answer(interview_question=self.iq, answer_text="x", score=-1).full_clean()

    def test_analysis_fields_store_json(self):
        answer = Answer.objects.create(
            interview_question=self.iq,
            answer_text="x",
            score=8,
            criteria={"accuracy": 8, "completeness": 7, "readability": 9},
            strengths=["Чёткое определение"],
            weaknesses=["Нет примера"],
        )
        answer.refresh_from_db()
        self.assertEqual(answer.criteria["accuracy"], 8)
        self.assertEqual(answer.strengths, ["Чёткое определение"])


class FeedbackAndDeletionTests(BaseTestCase):
    def test_feedback_defaults_and_verdict(self):
        feedback = InterviewFeedback.objects.create(interview=self.interview)
        self.assertEqual(feedback.status, AnalysisStatus.PENDING)
        self.assertIsNone(feedback.level_verdict)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                InterviewFeedback.objects.filter(pk=feedback.pk).update(level_verdict="BAD")

    def test_deleting_user_removes_interview_data_but_keeps_questions(self):
        iq = InterviewQuestion.objects.create(
            interview=self.interview, question=self.question, position=1
        )
        Answer.objects.create(interview_question=iq, answer_text="x")
        InterviewFeedback.objects.create(interview=self.interview)
        self.user.delete()
        self.assertEqual(Interview.objects.count(), 0)
        self.assertEqual(InterviewQuestion.objects.count(), 0)
        self.assertEqual(Answer.objects.count(), 0)
        self.assertEqual(InterviewFeedback.objects.count(), 0)
        self.assertEqual(Question.objects.count(), 1)


class InitialQuestionsTests(TestCase):
    def test_fixture_has_at_least_10_questions_per_level(self):
        call_command("loaddata", "questions", verbosity=0)
        for level in ("junior", "middle"):
            self.assertGreaterEqual(Question.objects.filter(level_id=level).count(), 10)

    def test_fixture_questions_have_reference_answers(self):
        call_command("loaddata", "questions", verbosity=0)
        self.assertFalse(Question.objects.filter(reference_answer__isnull=True).exists())
        self.assertFalse(Question.objects.exclude(source="BANK").exists())

    def test_fixture_can_be_loaded_twice_without_duplicates(self):
        call_command("loaddata", "questions", verbosity=0)
        first = Question.objects.count()
        call_command("loaddata", "questions", verbosity=0)
        self.assertEqual(Question.objects.count(), first)
