from rest_framework import serializers
from .event_state import compute_event_state
from .models import EventComment, EventLike
from .models import TempleEvent



ALLOWED_EVENT_STATUSES = {
    "draft",
    "published",
}

EVENT_STATE_LABELS = {
    "upcoming": "Upcoming",
    "ongoing": "Ongoing",
    "completed": "Completed",
}


class TempleEventSerializer(serializers.ModelSerializer):
    temple_id = serializers.IntegerField(
        read_only=True,
    )

    temple_name = serializers.CharField(
        source="temple.name",
        read_only=True,
    )

    # Event card meedha distance చూపించడానికి — Temple model లో
    # ఇప్పటికే ఉన్న lat/long ni ఇక్కడ కూడా expose చేస్తున్నాం.
    temple_latitude = serializers.DecimalField(
        source="temple.latitude",
        max_digits=9,
        decimal_places=6,
        read_only=True,
        allow_null=True,
    )

    temple_longitude = serializers.DecimalField(
        source="temple.longitude",
        max_digits=9,
        decimal_places=6,
        read_only=True,
        allow_null=True,
    )

    workspace_id = serializers.IntegerField(
        source="temple.workspace_id",
        read_only=True,
        allow_null=True,
    )

    event_type_display = serializers.CharField(
        source="get_event_type_display",
        read_only=True,
    )

    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    recurrence_display = serializers.CharField(
        source="get_recurrence_display",
        read_only=True,
    )

    # Ee event oka recurring series nunchi auto-generate ayina
    # occurrence aa ani frontend ki telియజేయడానికి (ఉదా. చిన్న
    # "repeats" badge చూపించడానికి, కావాలంటే).
    is_recurring_occurrence = serializers.SerializerMethodField()

    # Admin UI lo, oka series (template + దాని occurrences అన్నీ)
    # ni ఒకే group గా చూపించడానికి — idi null aithe standalone
    # (one-time) event; null కాకపోతే, ఇదే group_id ఉన్న events
    # అన్నీ ఒకే series కి చెందినవి.
    recurrence_group_id = serializers.SerializerMethodField()

    # Frontend ippudu multipart FormData tho real image file
    # pampistundi — write చేయగలిగేలా మార్చాం. Model లోనే
    # blank=True, null=True kabatti create/edit rendintlonu
    # image ivvakunda kuda save avvocchu.
    image = serializers.ImageField(
        required=False,
        allow_null=True,
        use_url=True,
    )

    created_by_name = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    event_state = serializers.SerializerMethodField()
    event_state_display = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = TempleEvent

        fields = [
            "id",
            "temple_id",
            "temple_name",
            "temple_latitude",
            "temple_longitude",
            "workspace_id",
            "title",
            "description",
            "event_type",
            "event_type_display",
            "event_date",
            "start_time",
            "end_time",
            "recurrence",
            "recurrence_display",
            "is_recurring_occurrence",
            "recurrence_group_id",
            "image",
            "status",
            "status_display",
            "event_state",
            "event_state_display",
            "created_by_name",
            "can_edit",
            "can_delete",
            "like_count",
            "is_liked",
            "comment_count",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "temple_id",
            "temple_name",
            "temple_latitude",
            "temple_longitude",
            "workspace_id",
            "event_type_display",
            "status_display",
            "recurrence_display",
            "is_recurring_occurrence",
            "recurrence_group_id",
            "event_state",
            "event_state_display",
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
                "Event title minimum 3 characters undali."
            )

        return value

    def validate_description(self, value):
        value = value.strip()

        if value and len(value) < 5:
            raise serializers.ValidationError(
                "Event details minimum 5 characters undali."
            )

        return value

    def validate_status(self, value):
        if value not in ALLOWED_EVENT_STATUSES:
            raise serializers.ValidationError(
                "Draft leda Published status select cheyyandi."
            )

        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        current_event = self.instance

        event_date = attrs.get(
            "event_date",
            getattr(current_event, "event_date", None),
        )

        start_time = attrs.get(
            "start_time",
            getattr(current_event, "start_time", None),
        )

        end_time = attrs.get(
            "end_time",
            getattr(current_event, "end_time", None),
        )

        errors = {}

        if event_date is None:
            errors["event_date"] = "Event date required."

        if end_time is not None and start_time is None:
            errors["start_time"] = (
                "End time add chesthe start time kuda required."
            )

        if (
            start_time is not None
            and end_time is not None
            and end_time <= start_time
        ):
            errors["end_time"] = (
                "End time start time taruvatha undali."
            )

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def get_created_by_name(self, obj):
        if obj.created_by is None:
            return "Former member"

        full_name = obj.created_by.get_full_name().strip()

        return full_name or obj.created_by.username

    def _get_event_state(self, obj):
        return compute_event_state(obj)

    def get_event_state(self, obj):
        return self._get_event_state(obj)

    def get_event_state_display(self, obj):
        state = self._get_event_state(obj)

        return EVENT_STATE_LABELS[state]

    def _can_manage_event(self, obj):
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
        return self._can_manage_event(obj)

    def get_can_delete(self, obj):
        return self._can_manage_event(obj)

    
    def get_like_count(self, obj):
        # PublicEventListView annotate chesi pampistే dానిని
        # vాడతాం (0 queries). Annotate చేయని callers kosam
        # (temple-admin views ivvi) పాత fallback query vాడతాం.
        annotated = getattr(obj, "like_count_annotated", None)

        if annotated is not None:
            return annotated

        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if user is None or not user.is_authenticated:
            return False

        # PublicEventListView oka query lo anni liked ids
        # ముందే తీసుకొచ్చి ఇక్కడ set గా pass chేస్తుంది.
        liked_event_ids = self.context.get("liked_event_ids")

        if liked_event_ids is not None:
            return obj.id in liked_event_ids

        return obj.likes.filter(user=user).exists()

    def get_comment_count(self, obj):
        annotated = getattr(obj, "comment_count_annotated", None)

        if annotated is not None:
            return annotated

        return obj.comments.count()

    def get_is_recurring_occurrence(self, obj):
        return obj.recurrence_parent_id is not None

    def get_recurrence_group_id(self, obj):
        if obj.recurrence != "none" or obj.recurrence_parent_id is not None:
            return obj.recurrence_parent_id or obj.id

        return None


class EventCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = EventComment
        fields = ["id", "user_name", "text", "created_at"]

    def get_user_name(self, obj):
        return obj.user.first_name or "Devotee"