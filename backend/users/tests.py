import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from .models import RevokedToken

User = get_user_model()


def make_user(email="a@example.com", **kwargs):
    kwargs.setdefault("full_name", "Иванов Иван Иванович")
    return User.objects.create_user(email=email, password="Secret123", **kwargs)


class UserTests(TestCase):
    def test_id_is_uuid(self):
        self.assertIsInstance(make_user().id, uuid.UUID)

    def test_password_is_stored_as_hash(self):
        user = make_user()
        self.assertNotEqual(user.password, "Secret123")
        self.assertTrue(user.check_password("Secret123"))

    def test_email_is_stored_in_lowercase(self):
        user = make_user(email="  Ivanov@Example.COM ")
        self.assertEqual(user.email, "ivanov@example.com")

    def test_email_must_be_unique_ignoring_case(self):
        make_user(email="ivanov@example.com")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                make_user(email="IVANOV@example.com")

    def test_full_name_is_required(self):
        user = User(email="b@example.com", full_name="")
        with self.assertRaises(ValidationError):
            user.full_clean(exclude=["password"])

    def test_timestamps_are_set(self):
        user = make_user()
        self.assertIsNotNone(user.created_at)
        self.assertIsNotNone(user.password_changed_at)

    def test_login_by_email_ignores_case(self):
        make_user(email="ivanov@example.com")
        self.assertTrue(self.client.login(username="IVANOV@example.com", password="Secret123"))


class RevokedTokenTests(TestCase):
    def test_revoked_token_is_deleted_with_user(self):
        user = make_user()
        RevokedToken.objects.create(
            jti=uuid.uuid4(), user=user, expires_at=timezone.now() + timedelta(hours=1)
        )
        user.delete()
        self.assertEqual(RevokedToken.objects.count(), 0)


class UserAdminFormTests(TestCase):
    def test_admin_can_create_user_with_mixed_case_email(self):
        admin = make_user(email="root@example.com", is_staff=True, is_superuser=True)
        self.client.force_login(admin)
        response = self.client.post(
            "/admin/users/user/add/",
            {
                "email": "New@Example.com",
                "full_name": "Новый Пользователь",
                "password1": "Zx9!kqLm#44a",
                "password2": "Zx9!kqLm#44a",
            },
        )
        self.assertEqual(response.status_code, 302)
        created = User.objects.get(email="new@example.com")
        self.assertTrue(created.check_password("Zx9!kqLm#44a"))
