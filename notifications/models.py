from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    TYPE_CHOICES = (
        (
            "temple_request_approved",
            "Temple Request Approved",
        ),
        (
            "temple_request_rejected",
            "Temple Request Rejected",
        ),
        (
            "verified_edit_access_approved",
            "Verified Edit Access Approved",
        ),
        (
            "verified_edit_access_rejected",
            "Verified Edit Access Rejected",
        ),
        (
            "verified_edit_changes_approved",
            "Verified Edit Changes Approved",
        ),
        (
            "verified_edit_changes_rejected",
            "Verified Edit Changes Rejected",
        ),
    )

    REFERENCE_TYPE_CHOICES = (
        (
            "temple_request",
            "Temple Request",
        ),
        (
            "verified_edit_request",
            "Verified Edit Request",
        ),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    temple = models.ForeignKey(
        "temples.Temple",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="temple_notifications",
    )

    notification_type = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
    )

    title = models.CharField(max_length=160)

    message = models.TextField()

    reference_type = models.CharField(
        max_length=40,
        choices=REFERENCE_TYPE_CHOICES,
        blank=True,
        default="",
    )

    reference_id = models.PositiveBigIntegerField(
        null=True,
        blank=True,
        db_index=True,
    )

    action_data = models.JSONField(
        default=dict,
        blank=True,
    )

    web_action_url = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    event_key = models.CharField(
        max_length=160,
        unique=True,
    )

    is_read = models.BooleanField(
        default=False,
        db_index=True,
    )

    read_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = (
            "-created_at",
            "-id",
        )

        indexes = [
            models.Index(
                fields=(
                    "recipient",
                    "is_read",
                    "-created_at",
                ),
                name="notif_user_read_created_idx",
            ),
            models.Index(
                fields=(
                    "reference_type",
                    "reference_id",
                ),
                name="notif_reference_lookup_idx",
            ),
        ]

    def __str__(self):
        return (
            f"{self.recipient.username} - "
            f"{self.title}"
        )

    def mark_as_read(self):
        if self.is_read:
            return

        self.is_read = True
        self.read_at = timezone.now()

        self.save(
            update_fields=(
                "is_read",
                "read_at",
                "updated_at",
            )
        )