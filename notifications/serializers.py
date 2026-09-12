from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(
        source="get_notification_type_display",
        read_only=True,
    )

    temple_id = serializers.IntegerField(
        read_only=True,
        allow_null=True,
    )

    temple_name = serializers.CharField(
        source="temple.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Notification

        fields = (
            "id",
            "notification_type",
            "notification_type_display",
            "title",
            "message",
            "temple_id",
            "temple_name",
            "reference_type",
            "reference_id",
            "action_data",
            "web_action_url",
            "is_read",
            "read_at",
            "created_at",
        )

        read_only_fields = fields