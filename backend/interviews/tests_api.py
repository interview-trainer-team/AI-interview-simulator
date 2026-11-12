from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Direction, Interview, InterviewStatus, Level, Question

User = get_user_model()

INTERVIEWS_URL = "/api/interviews"
CREATE_BODY = {"directionCode": "backend_python", "levelCode": "junior"}


class ApiTestCase(TestCase):
    fixtures = ["questions"]  # 20 тестовых вопросов

    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com", password="Secret123", full_name="Иванов Иван"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)  # пока без JWT, он будет в PR по авторизации

    def make_interview(self, user=None, status=InterviewStatus.CREATED, **extra):
        return Interview.objects.create(
            user=user or self.user,
            direction=Direction.objects.get(code="backend_python"),
            level=Level.objects.get(code="junior"),
            status=status,
            **extra,
        )


class DirectionsApiTests(ApiTestCase):
    def test_returns_directions_and_levels(self):
        response = self.client.get("/api/directions")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([d["code"] for d in response.data["directions"]], ["backend_python"])
        self.assertEqual([lv["code"] for lv in response.data["levels"]], ["junior", "middle"])

    def test_inactive_direction_is_hidden(self):
        Direction.objects.filter(code="backend_python").update(is_active=False)
        response = self.client.get("/api/directions")
        self.assertEqual(response.data["directions"], [])

    def test_requires_authentication(self):
        response = APIClient().get("/api/directions")
        self.assertIn(response.status_code, (401, 403))  # 401 появится вместе с JWT


class CreateInterviewApiTests(ApiTestCase):
    def test_creates_interview_with_5_questions(self):
        response = self.client.post(INTERVIEWS_URL, CREATE_BODY, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "CREATED")
        self.assertEqual(response.data["totalQuestions"], 5)
        self.assertTrue(response.data["createdAt"].endswith("Z"))

        interview = Interview.objects.get(id=response.data["id"])
        self.assertEqual(interview.user, self.user)
        links = list(interview.interview_questions.select_related("question"))
        self.assertEqual([link.position for link in links], [1, 2, 3, 4, 5])
        for link in links:
            self.assertEqual(link.question.level_id, "junior")
            self.assertEqual(link.question.direction_id, "backend_python")
        self.assertEqual(len({link.question_id for link in links}), 5)

    def test_missing_fields_return_validation_error(self):
        response = self.client.post(INTERVIEWS_URL, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "VALIDATION_ERROR")
        self.assertIn("directionCode", response.data["error"]["details"]["fields"])

    def test_unknown_direction_and_level(self):
        response = self.client.post(
            INTERVIEWS_URL, {"directionCode": "nope", "levelCode": "junior"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "UNKNOWN_DIRECTION")

        response = self.client.post(
            INTERVIEWS_URL,
            {"directionCode": "backend_python", "levelCode": "senior"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "UNKNOWN_LEVEL")

    def test_second_active_interview_is_rejected(self):
        first = self.client.post(INTERVIEWS_URL, CREATE_BODY, format="json")
        second = self.client.post(INTERVIEWS_URL, CREATE_BODY, format="json")
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.data["error"]["code"], "ACTIVE_INTERVIEW_EXISTS")
        self.assertEqual(second.data["error"]["details"]["interviewId"], first.data["id"])
        self.assertEqual(Interview.objects.filter(user=self.user).count(), 1)

    def test_completed_interview_does_not_block_new_one(self):
        self.make_interview(status=InterviewStatus.COMPLETED)
        response = self.client.post(INTERVIEWS_URL, CREATE_BODY, format="json")
        self.assertEqual(response.status_code, 201)

    def test_other_users_active_interview_does_not_block(self):
        other = User.objects.create_user(
            email="other@example.com", password="Secret123", full_name="Другой"
        )
        self.make_interview(user=other)
        response = self.client.post(INTERVIEWS_URL, CREATE_BODY, format="json")
        self.assertEqual(response.status_code, 201)

    def test_not_enough_questions_returns_503(self):
        ids = Question.objects.filter(level_id="junior").values_list("id", flat=True)[:6]
        Question.objects.filter(id__in=list(ids)).update(is_active=False)  # осталось 4
        response = self.client.post(INTERVIEWS_URL, CREATE_BODY, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"]["code"], "QUESTIONS_UNAVAILABLE")
        self.assertFalse(Interview.objects.exists())

    def test_requires_authentication(self):
        response = APIClient().post(INTERVIEWS_URL, CREATE_BODY, format="json")
        self.assertIn(response.status_code, (401, 403))


class InterviewHistoryApiTests(ApiTestCase):
    def test_default_returns_only_own_completed_newest_first(self):
        other = User.objects.create_user(
            email="other@example.com", password="Secret123", full_name="Другой"
        )
        old = self.make_interview(
            status=InterviewStatus.COMPLETED,
            total_score=6.5,
            completed_at=timezone.now() - timezone.timedelta(days=1),
        )
        new = self.make_interview(
            status=InterviewStatus.COMPLETED,
            total_score=8,
            finished_early=True,
            completed_at=timezone.now(),
        )
        self.make_interview(status=InterviewStatus.IN_PROGRESS)  # не в истории
        self.make_interview(user=other, status=InterviewStatus.COMPLETED)  # чужое

        response = self.client.get(INTERVIEWS_URL)
        self.assertEqual(response.status_code, 200)
        items = response.data["items"]
        self.assertEqual({i["id"] for i in items}, {str(old.id), str(new.id)})
        self.assertEqual(items[0]["id"], str(new.id))
        self.assertEqual(items[0]["totalScore"], 8.0)
        self.assertTrue(items[0]["finishedEarly"])
        self.assertEqual(items[0]["directionName"], "Backend-разработка (Python)")
        self.assertEqual(items[0]["levelName"], "Junior")
        self.assertTrue(items[0]["completedAt"].endswith("Z"))

    def test_status_active_returns_created_and_in_progress(self):
        active = self.make_interview(status=InterviewStatus.IN_PROGRESS)
        self.make_interview(status=InterviewStatus.COMPLETED)
        response = self.client.get(INTERVIEWS_URL, {"status": "ACTIVE"})
        self.assertEqual([i["id"] for i in response.data["items"]], [str(active.id)])

    def test_invalid_status_returns_400(self):
        response = self.client.get(INTERVIEWS_URL, {"status": "WRONG"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "VALIDATION_ERROR")

    def test_requires_authentication(self):
        response = APIClient().get(INTERVIEWS_URL)
        self.assertIn(response.status_code, (401, 403))