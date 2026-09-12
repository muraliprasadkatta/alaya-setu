from django.conf import settings
from django.db import models

from temples.models import Temple


class TempleEvent(models.Model):
    EVENT_TYPE_CHOICES = (
        ("festival", "Festival"),
        ("pooja", "Pooja"),
        ("seva", "Seva"),
        ("annadanam", "Annadanam"),
        ("pravachanam", "Pravachanam"),
        ("cleaning", "Temple Cleaning"),
        ("other", "Other"),
    )

    STATUS_CHOICES = (
        ("draft", "Draft"),
        ("pending", "Pending Review"),
        ("published", "Published"),
        ("rejected", "Rejected"),
    )

    RECURRENCE_CHOICES = (
        ("none", "Never"),
        ("daily", "Daily"),
        ("weekly", "Weekly"),
    )

    temple = models.ForeignKey(
        Temple,
        on_delete=models.CASCADE,
        related_name="events"
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    event_type = models.CharField(
        max_length=20,
        choices=EVENT_TYPE_CHOICES,
        default="festival"
    )

    event_date = models.DateField()
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)

    # Recurring events (ఉదా. "prathi Friday pooja"): 'none' aithe
    # normal, one-time event. 'weekly' aithe — repeat ayye day of
    # week, ee event_date నుండే derive avutundi (వేరే field అవసరం
    # లేదు) — 'daily'/'weekly' set చేసింది matrame "template" row;
    # దాని nunchi auto-generate ayye occurrences ki
    # recurrence_parent ఈ template ni point చేస్తుంది.
    recurrence = models.CharField(
        max_length=10,
        choices=RECURRENCE_CHOICES,
        default="none",
    )

    recurrence_parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="occurrences",
    )

    image = models.ImageField(
        upload_to="temple_events/",
        blank=True,
        null=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="published"
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_temple_events"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["event_date", "start_time"]

    def __str__(self):
        return f"{self.temple.name} - {self.title}"# Create your models here.


from django.conf import settings


class EventLike(models.Model):
    event = models.ForeignKey(
        TempleEvent,
        on_delete=models.CASCADE,
        related_name="likes",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="liked_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("event", "user")

    def __str__(self):
        return f"{self.user} likes {self.event}"


class EventComment(models.Model):
    event = models.ForeignKey(
        TempleEvent,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_comments",
    )
    text = models.TextField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.user} on {self.event}: {self.text[:30]}"