from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "recipient",
        "notification_type",
        "temple",
        "is_read",
        "created_at",
    )

    list_filter = (
        "notification_type",
        "is_read",
        "created_at",
    )

    search_fields = (
        "title",
        "message",
        "recipient__username",
        "temple__name",
    )

    list_select_related = (
        "recipient",
        "temple",
    )

    readonly_fields = (
        "recipient",
        "temple",
        "notification_type",
        "title",
        "message",
        "reference_type",
        "reference_id",
        "action_data",
        "web_action_url",
        "event_key",
        "is_read",
        "read_at",
        "created_at",
        "updated_at",
    )

    ordering = (
        "-created_at",
    )

    def has_add_permission(self, request):
        return False