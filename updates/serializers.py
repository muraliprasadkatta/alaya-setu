from rest_framework import serializers

from .models import TempleUpdate


ALLOWED_ANNOUNCEMENT_STATUSES = {
    "draft",
    "published",
}


class TempleAnnouncementSerializer(serializers.ModelSerializer):
    temple_id = serializers.IntegerField(
        read_only=True,
    )

    temple_name = serializers.CharField(
        source="temple.name",
        read_only=True,
    )

    update_type_display = serializers.CharField(
        source="get_update_type_display",
        read_only=True,
    )

    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    created_by_name = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = TempleUpdate

        fields = [
            "id",
            "temple_id",
            "temple_name",
            "title",
            "description",
            "update_type",
            "update_type_display",
            "starts_at",
            "ends_at",
            "status",
            "status_display",
            "created_by_name",
            "can_edit",
            "can_delete",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "temple_id",
            "temple_name",
            "update_type_display",
            "status_display",
            "created_by_name",
            "can_edit",
            "can_delete",
            "created_at",
            "updated_at",
        ]

    def validate_title(self, value):
        value = " ".join(value.split())

        if len(value) < 3:
            raise serializers.ValidationError(
                "Announcement title minimum 3 characters undali."
            )

        return value

    def validate_description(self, value):
        value = value.strip()

        if len(value) < 5:
            raise serializers.ValidationError(
                "Announcement details minimum 5 characters undali."
            )

        return value

    def validate_status(self, value):
        if value not in ALLOWED_ANNOUNCEMENT_STATUSES:
            raise serializers.ValidationError(
                "Draft leda Published status select cheyyandi."
            )

        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        current_announcement = self.instance

        starts_at = attrs.get(
            "starts_at",
            getattr(
                current_announcement,
                "starts_at",
                None,
            ),
        )

        ends_at = attrs.get(
            "ends_at",
            getattr(
                current_announcement,
                "ends_at",
                None,
            ),
        )

        errors = {}

        if starts_at is None:
            errors["starts_at"] = (
                "Start date and time required."
            )

        if ends_at is None:
            errors["ends_at"] = (
                "End date and time required."
            )

        if (
            starts_at is not None
            and ends_at is not None
            and ends_at <= starts_at
        ):
            errors["ends_at"] = (
                "End date and time start taruvatha undali."
            )

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def get_created_by_name(self, obj):
        if obj.created_by is None:
            return "Former member"

        full_name = obj.created_by.get_full_name().strip()

        return full_name or obj.created_by.username

    def _can_manage_announcement(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if user is None or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        workspace_owner_id = self.context.get(
            "workspace_owner_id"
        )

        if user.id == workspace_owner_id:
            return True

        if obj.created_by_id == user.id:
            return True

        memberships_by_temple_id = self.context.get(
            "memberships_by_temple_id",
            {},
        )

        membership = memberships_by_temple_id.get(
            obj.temple_id
        )

        if membership is None:
            fallback_membership = self.context.get(
                "membership"
            )

            if (
                fallback_membership is not None
                and fallback_membership.temple_id
                == obj.temple_id
            ):
                membership = fallback_membership

        return (
            membership is not None
            and membership.role in {
                "owner",
                "manager",
            }
        )

    def get_can_edit(self, obj):
        return self._can_manage_announcement(obj)

    def get_can_delete(self, obj):
        return self._can_manage_announcement(obj)