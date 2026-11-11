from django.db import models

class RevokedToken(models.Model):
    jti = models.CharField(max_length=255, unique=True)
    user_id = models.IntegerField()
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.jti