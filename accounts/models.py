from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = (
        ("devotee", "Devotee"),
        (
            "pending_temple_admin",
            "Pending Temple Admin",
        ),
        ("temple_admin", "Temple Admin"),
        ("temple_member", "Temple Member"),
        ("super_admin", "Super Admin"),
    )

    role = models.CharField(
        max_length=30,
        choices=ROLE_CHOICES,
        default="devotee",
    )

    phone_number = models.CharField(
        max_length=15,
        blank=True,
        null=True,
    )

    def __str__(self):
        return self.username

import random
from datetime import timedelta

from django.utils import timezone


class OTPRequest(models.Model):
    phone_number = models.CharField(max_length=15)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"{self.phone_number} - {self.code}"