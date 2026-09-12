from django.conf import settings
from django.db import models

from temples.models import Temple


class TempleUpdate(models.Model):
    UPDATE_TYPE_CHOICES = (
        ("general", "General"),
        ("pooja", "Pooja"),
        ("seva", "Seva"),
        ("annadanam", "Annadanam"),
        ("notice", "Notice"),
        ("festival", "Festival"),
    )

    STATUS_CHOICES = (
        ("draft", "Draft"),
        ("pending", "Pending Review"),
        ("published", "Published"),
        ("rejected", "Rejected"),
    )

    temple = models.ForeignKey(
        Temple,
        on_delete=models.CASCADE,
        related_name="updates",
    )

    title = models.CharField(max_length=255)
    description = models.TextField()

    update_type = models.CharField(
        max_length=20,
        choices=UPDATE_TYPE_CHOICES,
        default="general",
    )

    starts_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    ends_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="published",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_temple_updates",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.temple.name} - {self.title}"