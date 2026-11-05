from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import Answer, Interview, InterviewStatus, Level, Question

User = get_user_model()


class UserTests(TestCase):
    def test_password_is_stored_as_hash(self):
        user = User.objects.create_user(email="a@example.com", password="Secret123!")
        self.assertNotEqual(user.password, "Secret123!")
        self.assertTrue(user.check_password("Secret123!"))

    def test_email_must_be_unique(self):
        User.objects.create_user(email="a@example.com", password="Secret123!")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(email="a@example.com", password="Other123!")


class InterviewModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="a@example.com", password="Secret123!")
        self.interview = Interview.objects.create(
            user=self.user, direction="Python", level=Level.JUNIOR
        )
        self.question = Question.objects.create(text="Q1", direction="Python", level=Level.JUNIOR)

    def test_new_interview_has_created_status(self):
        self.assertEqual(self.interview.status, InterviewStatus.CREATED)

    def test_invalid_level_and_status_are_rejected(self):
        bad = Interview(user=self.user, direction="Python", level="SENIOR", status="DONE")
        with self.assertRaises(ValidationError):
            bad.full_clean()
        # то же правило действует на уровне базы данных
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Interview.objects.create(user=self.user, direction="Python", level="SENIOR")

    def test_score_must_be_between_0_and_10(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Answer.objects.create(
                    interview=self.interview, question=self.question, order_number=1, score=11
                )
        with self.assertRaises(ValidationError):
            Answer(
                interview=self.interview, question=self.question, order_number=1, score=-1
            ).full_clean()

    def test_question_is_unique_within_interview(self):
        Answer.objects.create(interview=self.interview, question=self.question, order_number=1)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Answer.objects.create(
                    interview=self.interview, question=self.question, order_number=2
                )


class InitialQuestionsTests(TestCase):
    def test_fixture_has_at_least_10_questions_per_level(self):
        call_command("loaddata", "questions", verbosity=0)
        for level in (Level.JUNIOR, Level.MIDDLE):
            self.assertGreaterEqual(Question.objects.filter(level=level).count(), 10)

    def test_fixture_can_be_loaded_twice_without_duplicates(self):
        call_command("loaddata", "questions", verbosity=0)
        first = Question.objects.count()
        call_command("loaddata", "questions", verbosity=0)
        self.assertEqual(Question.objects.count(), first)
