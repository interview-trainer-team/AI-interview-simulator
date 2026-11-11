import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class UserManager(BaseUserManager):
    """Создаёт пользователей. Вход идёт по email, а не по логину."""

    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email обязателен")
        user = self.model(email=email, **extra_fields)  # email приводится к нижнему регистру в save()
        user.set_password(password)  # пароль превращается в хеш
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)

    def get_by_natural_key(self, email):
        # вход по email без учёта регистра
        return self.get(email=email.strip().lower())


class User(AbstractBaseUser, PermissionsMixin):
    """Пользователь (таблица users). Поле password хранит хеш пароля."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=150)
    email = models.EmailField(max_length=255, unique=True)
    # Токены, выданные раньше этого времени, недействительны (смена пароля)
    password_changed_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(email=Lower("email")),
                name="user_email_lowercase",
            ),
        ]

    def clean(self):
        super().clean()
        # приводим email к нижнему регистру до проверок формы (админка, API)
        self.email = self.email.strip().lower()

    def save(self, *args, **kwargs):
        # email всегда хранится в нижнем регистре (API-контракт, 8.6)
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class RevokedToken(models.Model):
    """Токены, отозванные при выходе (таблица revoked_tokens)."""

    jti = models.UUIDField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="revoked_tokens",
    )
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(default=timezone.now, editable=False)

    def __str__(self):
        return f"{self.jti} ({self.user_id})"
