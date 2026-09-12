import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    PincodeLocation,
    Temple,
    TempleMember,
    TempleRequest,
    TempleVerifiedEditRequest,
)


PINCODE_PATTERN = re.compile(r"^[1-9][0-9]{5}$")
PHONE_PATTERN = re.compile(r"^[0-9]{10}$")

POST_OFFICE_SUFFIX_PATTERN = re.compile(
    r"\s+(?:B\.O|S\.O|H\.O)$",
    re.IGNORECASE,
)

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_@.+-]+$")

ACTIVE_VERIFIED_EDIT_STATUSES = (
    "access_pending",
    "edit_allowed",
    "changes_pending",
)

User = get_user_model()


def get_city_name(office_name):
    """
    Example:
    'Tadepalligudem H.O' -> 'Tadepalligudem'
    """
    return POST_OFFICE_SUFFIX_PATTERN.sub(
        "",
        office_name,
    ).strip()


def can_resubmit_temple_request(obj):
    if obj.status != "rejected":
        return False

    return not obj.resubmissions.exists()



class TempleRequestCreateSerializer(serializers.ModelSerializer):
    existing_temple = serializers.PrimaryKeyRelatedField(
        queryset=Temple.objects.filter(is_verified=True),
        required=False,
        allow_null=True,
    )

    pincode_location = serializers.PrimaryKeyRelatedField(
        queryset=PincodeLocation.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = TempleRequest

        fields = [
            "id",
            "request_type",
            "existing_temple",
            "temple_name",
            "main_deity",
            "temple_image",
            "opening_time",
            "closing_time",
            "description",
            "address",
            "city",
            "district",
            "state",
            "pincode",
            "pincode_location",
            "latitude",
            "longitude",
            "contact_person_name",
            "contact_phone",
            "proof_image",
            "status",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "status",
            "created_at",
        ]

        extra_kwargs = {
            "temple_name": {
                "required": False,
                "allow_blank": True,
            },
            "main_deity": {
                "required": False,
                "allow_blank": True,
            },
            "temple_image": {
                "required": False,
                "allow_null": True,
            },
            "opening_time": {
                "required": False,
                "allow_null": True,
            },
            "closing_time": {
                "required": False,
                "allow_null": True,
            },
            "description": {
                "required": False,
                "allow_blank": True,
            },
            "address": {
                "required": False,
                "allow_blank": True,
            },
            "city": {
                "required": False,
                "allow_blank": True,
            },
            "district": {
                "required": False,
                "allow_blank": True,
            },
            "state": {
                "required": False,
                "allow_blank": True,
            },
            "pincode": {
                "required": False,
                "allow_blank": True,
            },
            "latitude": {
                "required": False,
                "allow_null": True,
            },
            "longitude": {
                "required": False,
                "allow_null": True,
            },
            "contact_person_name": {
                "required": True,
                "allow_blank": False,
            },
            "contact_phone": {
                "required": True,
                "allow_blank": False,
            },
            "proof_image": {
                "required": False,
                "allow_null": True,
            },
        }

    def validate_temple_name(self, value):
        value = value.strip()

        if value and len(value) < 3:
            raise serializers.ValidationError(
                "Temple name minimum 3 characters undali."
            )

        return value

    def validate_pincode(self, value):
        value = value.strip()

        if value and not PINCODE_PATTERN.fullmatch(value):
            raise serializers.ValidationError(
                "Valid 6-digit Indian pincode enter cheyyandi."
            )

        return value

    def validate_contact_phone(self, value):
        value = value.strip()

        if not PHONE_PATTERN.fullmatch(value):
            raise serializers.ValidationError(
                "Valid 10-digit contact phone enter cheyyandi."
            )

        return value

    def validate_temple_image(self, value):
        if value is None:
            return value

        maximum_size = 5 * 1024 * 1024

        if value.size > maximum_size:
            raise serializers.ValidationError(
                "Temple image size 5 MB lopu undali."
            )

        allowed_content_types = {
            "image/jpeg",
            "image/png",
            "image/webp",
        }

        content_type = getattr(value, "content_type", "")

        if content_type and content_type not in allowed_content_types:
            raise serializers.ValidationError(
                "JPG, PNG leda WEBP image upload cheyyandi."
            )

        return value

    def validate_latitude(self, value):
        if value is not None and not -90 <= value <= 90:
            raise serializers.ValidationError(
                "Latitude -90 nunchi 90 madhyalo undali."
            )

        return value

    def validate_longitude(self, value):
        if value is not None and not -180 <= value <= 180:
            raise serializers.ValidationError(
                "Longitude -180 nunchi 180 madhyalo undali."
            )

        return value

    def validate(self, attrs):
        attrs["contact_person_name"] = (
            attrs["contact_person_name"].strip()
        )

        request_type = attrs.get(
            "request_type",
            "new_temple",
        )

        if request_type == "claim_temple":
            return self._validate_claim_request(attrs)

        return self._validate_new_temple_request(attrs)

    def _validate_claim_request(self, attrs):
        existing_temple = attrs.get("existing_temple")

        if existing_temple is None:
            raise serializers.ValidationError(
                {
                    "existing_temple": (
                        "Claim request-ki existing temple "
                        "select cheyyandi."
                    )
                }
            )

        request = self.context.get("request")

        if request and request.user.is_authenticated:
            already_member = TempleMember.objects.filter(
                temple=existing_temple,
                user=request.user,
            ).exists()

            if already_member:
                raise serializers.ValidationError(
                    {
                        "existing_temple": (
                            "Meeru already ee temple member-ga unnaru."
                        )
                    }
                )

            pending_claim_exists = TempleRequest.objects.filter(
                submitted_by=request.user,
                request_type="claim_temple",
                existing_temple=existing_temple,
                status="pending",
            ).exists()

            if pending_claim_exists:
                raise serializers.ValidationError(
                    {
                        "existing_temple": (
                            "Ee temple-ki pending claim request "
                            "already undhi."
                        )
                    }
                )

        attrs.update(
            {
                "existing_temple": existing_temple,
                "temple_name": existing_temple.name.strip(),
                "main_deity": existing_temple.main_deity.strip(),
                "description": existing_temple.description.strip(),
                "address": existing_temple.address.strip(),
                "city": existing_temple.city.strip(),
                "district": existing_temple.district.strip(),
                "state": existing_temple.state.strip(),
                "pincode": existing_temple.pincode.strip(),
                "pincode_location": (
                    existing_temple.pincode_location
                ),
                "latitude": existing_temple.latitude,
                "longitude": existing_temple.longitude,
            }
        )

        return attrs

    def _validate_new_temple_request(self, attrs):
        if attrs.get("existing_temple") is not None:
            raise serializers.ValidationError(
                {
                    "existing_temple": (
                        "New temple request-ki existing temple "
                        "select cheyyakudadhu."
                    )
                }
            )

        required_fields = {
            "temple_name": "Temple name enter cheyyandi.",
            "main_deity": "Main deity enter cheyyandi.",
            "address": "Full temple address enter cheyyandi.",
            "pincode": "Valid pincode enter cheyyandi.",
        }

        errors = {}

        for field_name, error_message in required_fields.items():
            value = attrs.get(field_name)

            if not isinstance(value, str) or not value.strip():
                errors[field_name] = error_message
            else:
                attrs[field_name] = value.strip()

        if errors:
            raise serializers.ValidationError(errors)

        pincode = attrs["pincode"]

        if not PINCODE_PATTERN.fullmatch(pincode):
            raise serializers.ValidationError(
                {
                    "pincode": (
                        "Valid 6-digit Indian pincode enter cheyyandi."
                    )
                }
            )

        attrs["description"] = attrs.get(
            "description",
            "",
        ).strip()

        location = attrs.get("pincode_location")

        available_locations = PincodeLocation.objects.filter(
            pincode=pincode
        )

        if location is not None:
            if location.pincode != pincode:
                raise serializers.ValidationError(
                    {
                        "pincode_location": (
                            "Selected Post Office ee pincode-ki "
                            "match avvatledhu."
                        )
                    }
                )

            attrs["state"] = location.state.strip()
            attrs["district"] = location.district.strip()
            attrs["city"] = get_city_name(
                location.office_name
            )

        elif available_locations.exists():
            raise serializers.ValidationError(
                {
                    "pincode_location": (
                        "Correct Post Office / Area select cheyyandi."
                    )
                }
            )

        else:
            manual_fields = {
                "state": "State enter cheyyandi.",
                "district": "District enter cheyyandi.",
                "city": "Village / Town / City enter cheyyandi.",
            }

            manual_errors = {}

            for field_name, error_message in manual_fields.items():
                value = attrs.get(field_name)

                if not isinstance(value, str) or not value.strip():
                    manual_errors[field_name] = error_message
                else:
                    attrs[field_name] = value.strip()

            if manual_errors:
                raise serializers.ValidationError(
                    manual_errors
                )

        request = self.context.get("request")

        if request and request.user.is_authenticated:
            duplicate_request_exists = TempleRequest.objects.filter(
                submitted_by=request.user,
                request_type="new_temple",
                temple_name__iexact=attrs["temple_name"],
                pincode=pincode,
                status="pending",
            ).exists()

            if duplicate_request_exists:
                raise serializers.ValidationError(
                    {
                        "non_field_errors": [
                            (
                                "Ee temple-ki pending request "
                                "already submit chesaru."
                            )
                        ]
                    }
                )

        verified_temple_exists = Temple.objects.filter(
            is_verified=True,
            name__iexact=attrs["temple_name"],
            pincode=pincode,
        ).exists()

        if verified_temple_exists:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        (
                            "Matching verified temple already undhi. "
                            "Claim Existing Temple option use cheyyandi."
                        )
                    ]
                }
            )

        return attrs




class TempleRequestResubmitSerializer(
    TempleRequestCreateSerializer
):
    rejection_reason = serializers.CharField(
        read_only=True,
    )

    can_resubmit = serializers.SerializerMethodField()

    class Meta(TempleRequestCreateSerializer.Meta):
        fields = [
            *TempleRequestCreateSerializer.Meta.fields,
            "rejection_reason",
            "can_resubmit",
        ]

        read_only_fields = [
            *TempleRequestCreateSerializer.Meta.read_only_fields,
            "rejection_reason",
            "can_resubmit",
        ]

    def get_can_resubmit(self, obj):
        return can_resubmit_temple_request(obj)

    def validate(self, attrs):
        original_request = self.context.get(
            "original_request"
        )

        if original_request is None:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Original rejected request information missing."
                    ]
                }
            )

        submitted_request_type = attrs.get(
            "request_type",
            original_request.request_type,
        )

        if (
            submitted_request_type
            != original_request.request_type
        ):
            raise serializers.ValidationError(
                {
                    "request_type": (
                        "Resubmit chestunnappudu request type "
                        "change cheyyakudadhu."
                    )
                }
            )

        submitted_existing_temple = attrs.get(
            "existing_temple",
            original_request.existing_temple,
        )

        if (
            submitted_existing_temple
            != original_request.existing_temple
        ):
            raise serializers.ValidationError(
                {
                    "existing_temple": (
                        "Resubmit chestunnappudu selected temple "
                        "change cheyyakudadhu."
                    )
                }
            )

        attrs["request_type"] = (
            original_request.request_type
        )

        attrs["existing_temple"] = (
            original_request.existing_temple
        )

        attrs = super().validate(attrs)

        if (
            attrs.get("temple_image") is None
            and original_request.temple_image
        ):
            attrs["temple_image"] = (
                original_request.temple_image
            )

        if (
            attrs.get("proof_image") is None
            and original_request.proof_image
        ):
            attrs["proof_image"] = (
                original_request.proof_image
            )

        return attrs


    
class TempleRequestStatusSerializer(
    serializers.ModelSerializer
):
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    resubmitted_from_id = serializers.IntegerField(
        read_only=True,
        allow_null=True,
    )

    can_resubmit = serializers.SerializerMethodField()

    class Meta:
        model = TempleRequest

        fields = [
            "id",
            "request_type",
            "temple_name",
            "status",
            "status_display",
            "rejection_reason",
            "resubmitted_from_id",
            "can_resubmit",
            "created_at",
        ]

        read_only_fields = fields

    def get_can_resubmit(self, obj):
        return can_resubmit_temple_request(obj)



class MyTempleSerializer(serializers.ModelSerializer):
    membership_role = serializers.CharField(read_only=True)

    class Meta:
        model = Temple

        fields = [
            "id",
            "name",
            "main_deity",
            "city",
            "district",
            "state",
            "pincode",
            "image",
            "is_verified",
            "membership_role",
        ]

        read_only_fields = fields


class TempleVerifiedEditRequestSerializer(
    serializers.ModelSerializer
):
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    rejected_stage_display = serializers.CharField(
        source="get_rejected_stage_display",
        read_only=True,
    )

    can_submit_changes = serializers.SerializerMethodField()
    changed_fields = serializers.SerializerMethodField()

    class Meta:
        model = TempleVerifiedEditRequest

        fields = [
            "id",
            "request_reason",
            "status",
            "status_display",
            "original_name",
            "original_pincode",
            "original_city",
            "original_district",
            "original_state",
            "original_pincode_location",
            "proposed_name",
            "proposed_pincode",
            "proposed_city",
            "proposed_district",
            "proposed_state",
            "proposed_pincode_location",
            "rejected_stage",
            "rejected_stage_display",
            "rejection_reason",
            "access_reviewed_at",
            "submitted_at",
            "final_reviewed_at",
            "created_at",
            "updated_at",
            "can_submit_changes",
            "changed_fields",
        ]

        read_only_fields = fields

    def get_can_submit_changes(self, obj):
        if obj.status != "edit_allowed":
            return False

        request = self.context.get("request")

        if request is None or not request.user.is_authenticated:
            return obj.can_submit_changes

        return (
            obj.requested_by_id == request.user.id
            or request.user.is_superuser
        )

    def get_changed_fields(self, obj):
        if obj.submitted_at is None:
            return {}

        return obj.get_changed_fields()


class TempleVerifiedEditAccessRequestSerializer(
    serializers.Serializer
):
    request_reason = serializers.CharField(
        min_length=5,
        max_length=1000,
        trim_whitespace=True,
    )

    def validate_request_reason(self, value):
        value = " ".join(value.split())

        if len(value) < 5:
            raise serializers.ValidationError(
                "Edit request reason clear-ga enter cheyyandi."
            )

        return value

    @transaction.atomic
    def create(self, validated_data):
        temple = validated_data.pop("temple", None)
        requested_by = validated_data.pop(
            "requested_by",
            None,
        )

        if temple is None:
            raise serializers.ValidationError(
                {
                    "temple": (
                        "Temple information missing."
                    )
                }
            )

        if requested_by is None:
            raise serializers.ValidationError(
                {
                    "requested_by": (
                        "Request user information missing."
                    )
                }
            )

        if not temple.is_verified:
            raise serializers.ValidationError(
                {
                    "temple": (
                        "Verified temple details-ku matrame "
                        "edit request create cheyyavachu."
                    )
                }
            )

        active_request_exists = (
            TempleVerifiedEditRequest.objects.filter(
                temple=temple,
                status__in=ACTIVE_VERIFIED_EDIT_STATUSES,
            ).exists()
        )

        if active_request_exists:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        (
                            "Ee temple-ki active verified-details "
                            "edit request already undhi."
                        )
                    ]
                }
            )

        try:
            return TempleVerifiedEditRequest.objects.create(
                temple=temple,
                requested_by=requested_by,
                request_reason=validated_data[
                    "request_reason"
                ],
            )
        except IntegrityError as error:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        (
                            "Ee temple-ki active verified-details "
                            "edit request already undhi."
                        )
                    ]
                }
            ) from error


class TempleVerifiedEditSubmitSerializer(
    serializers.Serializer
):
    name = serializers.CharField(
        min_length=3,
        max_length=255,
        trim_whitespace=True,
    )

    pincode = serializers.CharField(
        min_length=6,
        max_length=6,
        trim_whitespace=True,
    )

    pincode_location = serializers.PrimaryKeyRelatedField(
        queryset=PincodeLocation.objects.all(),
        required=False,
        allow_null=True,
    )

    city = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )

    district = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )

    state = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )

    def validate_name(self, value):
        value = " ".join(value.split())

        if len(value) < 3:
            raise serializers.ValidationError(
                "Temple name minimum 3 characters undali."
            )

        return value

    def validate_pincode(self, value):
        value = value.strip()

        if not PINCODE_PATTERN.fullmatch(value):
            raise serializers.ValidationError(
                "Valid 6-digit Indian pincode enter cheyyandi."
            )

        return value

    def validate(self, attrs):
        edit_request = self.instance

        if edit_request is None:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Verified edit request information missing."
                    ]
                }
            )

        if edit_request.status != "edit_allowed":
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        (
                            "Super admin edit access approve "
                            "chesina tarvata matrame changes "
                            "submit cheyyavachu."
                        )
                    ]
                }
            )

        request = self.context.get("request")

        if (
            request
            and request.user.is_authenticated
            and not request.user.is_superuser
            and edit_request.requested_by_id != request.user.id
        ):
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        (
                            "Ee edit request create chesina user "
                            "matrame changes submit cheyyagaladu."
                        )
                    ]
                }
            )

        pincode = attrs["pincode"]
        location = attrs.get("pincode_location")

        available_locations = PincodeLocation.objects.filter(
            pincode=pincode
        )

        if location is not None:
            if location.pincode != pincode:
                raise serializers.ValidationError(
                    {
                        "pincode_location": (
                            "Selected Post Office ee pincode-ki "
                            "match avvatledhu."
                        )
                    }
                )

            attrs["state"] = location.state.strip()
            attrs["district"] = location.district.strip()
            attrs["city"] = get_city_name(
                location.office_name
            )

            attrs["latitude"] = location.latitude
            attrs["longitude"] = location.longitude

        elif available_locations.exists():
            raise serializers.ValidationError(
                {
                    "pincode_location": (
                        "Correct Post Office / Area select cheyyandi."
                    )
                }
            )

        else:
            manual_fields = {
                "state": "State enter cheyyandi.",
                "district": "District enter cheyyandi.",
                "city": "Village / Town / City enter cheyyandi.",
            }

            manual_errors = {}

            for field_name, error_message in manual_fields.items():
                value = attrs.get(field_name, "")

                if not isinstance(value, str) or not value.strip():
                    manual_errors[field_name] = error_message
                else:
                    attrs[field_name] = " ".join(
                        value.split()
                    )

            if manual_errors:
                raise serializers.ValidationError(
                    manual_errors
                )

            attrs["pincode_location"] = None
            attrs["latitude"] = None
            attrs["longitude"] = None

        proposed_values = {
            "name": attrs["name"],
            "pincode": attrs["pincode"],
            "city": attrs["city"],
            "district": attrs["district"],
            "state": attrs["state"],
            "pincode_location_id": (
                attrs["pincode_location"].id
                if attrs.get("pincode_location")
                else None
            ),
        }

        original_values = {
            "name": edit_request.original_name,
            "pincode": edit_request.original_pincode,
            "city": edit_request.original_city,
            "district": edit_request.original_district,
            "state": edit_request.original_state,
            "pincode_location_id": (
                edit_request.original_pincode_location_id
            ),
        }

        if proposed_values == original_values:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        (
                            "Verified details lo minimum oka "
                            "field aina change cheyyandi."
                        )
                    ]
                }
            )

        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        instance.proposed_name = validated_data["name"]

        instance.proposed_pincode = validated_data[
            "pincode"
        ]

        instance.proposed_city = validated_data["city"]

        instance.proposed_district = validated_data[
            "district"
        ]

        instance.proposed_state = validated_data["state"]

        instance.proposed_pincode_location = (
            validated_data.get("pincode_location")
        )

        instance.proposed_latitude = validated_data.get(
            "latitude"
        )

        instance.proposed_longitude = validated_data.get(
            "longitude"
        )

        instance.status = "changes_pending"
        instance.submitted_at = timezone.now()

        instance.rejected_stage = ""
        instance.rejection_reason = ""

        instance.save(
            update_fields=[
                "proposed_name",
                "proposed_pincode",
                "proposed_city",
                "proposed_district",
                "proposed_state",
                "proposed_pincode_location",
                "proposed_latitude",
                "proposed_longitude",
                "status",
                "submitted_at",
                "rejected_stage",
                "rejection_reason",
                "updated_at",
            ]
        )

        return instance

    def create(self, validated_data):
        raise NotImplementedError(
            "Verified changes create method support cheyyadhu."
        )


class TempleManagementSerializer(serializers.ModelSerializer):
    membership_role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    announcement_count = serializers.SerializerMethodField()
    event_count = serializers.SerializerMethodField()
    verified_edit_request = serializers.SerializerMethodField()

    can_request_verified_edit = (
        serializers.SerializerMethodField()
    )

    can_edit_verified_details = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = Temple

        fields = [
            "id",
            "name",
            "description",
            "main_deity",
            "image",
            "address",
            "city",
            "district",
            "state",
            "pincode",
            "latitude",
            "longitude",
            "opening_time",
            "closing_time",
            "is_verified",
            "membership_role",
            "announcement_count",
            "event_count",
            "member_count",
            "verified_edit_request",
            "can_request_verified_edit",
            "can_edit_verified_details",
            "created_at",
            "updated_at",
        ]

        read_only_fields = fields

    def _get_latest_verified_edit_request(self, obj):
        if not hasattr(
            self,
            "_verified_edit_request_cache",
        ):
            self._verified_edit_request_cache = {}

        if obj.pk not in self._verified_edit_request_cache:
            latest_request = (
                obj.verified_edit_requests
                .order_by("-created_at")
                .first()
            )

            self._verified_edit_request_cache[
                obj.pk
            ] = latest_request

        return self._verified_edit_request_cache[obj.pk]

    def get_membership_role(self, obj):
        membership = self.context.get("membership")

        if membership is None:
            return None

        return membership.role

    def get_member_count(self, obj):
        return obj.members.count()

    def get_announcement_count(self, obj):
        from updates.models import TempleUpdate

        if obj.workspace_id is not None:
            return TempleUpdate.objects.filter(
                temple__workspace_id=obj.workspace_id,
            ).count()

        return obj.updates.count()



    def get_event_count(self, obj):
        from events.models import TempleEvent

        if obj.workspace_id is not None:
            return TempleEvent.objects.filter(
                temple__workspace_id=obj.workspace_id,
            ).count()

        return obj.events.count()


    def get_verified_edit_request(self, obj):
        latest_request = (
            self._get_latest_verified_edit_request(obj)
        )

        if latest_request is None:
            return None

        return TempleVerifiedEditRequestSerializer(
            latest_request,
            context=self.context,
        ).data

    def get_can_request_verified_edit(self, obj):
        membership = self.context.get("membership")

        if membership is None or membership.role != "owner":
            return False

        active_request_exists = (
            obj.verified_edit_requests.filter(
                status__in=ACTIVE_VERIFIED_EDIT_STATUSES,
            ).exists()
        )

        return not active_request_exists

    def get_can_edit_verified_details(self, obj):
        membership = self.context.get("membership")

        if membership is None or membership.role != "owner":
            return False

        latest_request = (
            self._get_latest_verified_edit_request(obj)
        )

        if (
            latest_request is None
            or latest_request.status != "edit_allowed"
        ):
            return False

        request = self.context.get("request")

        if request is None or not request.user.is_authenticated:
            return True

        return (
            latest_request.requested_by_id
            == request.user.id
        )


class TempleUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Temple

        fields = [
            "description",
            "main_deity",
            "address",
            "opening_time",
            "closing_time",
            "image",
        ]

        extra_kwargs = {
            "description": {
                "required": False,
                "allow_blank": True,
            },
            "main_deity": {
                "required": False,
                "allow_blank": True,
            },
            "address": {
                "required": False,
                "allow_blank": False,
            },
            "opening_time": {
                "required": False,
                "allow_null": True,
            },
            "closing_time": {
                "required": False,
                "allow_null": True,
            },
            "image": {
                "required": False,
                "allow_null": True,
            },
        }

    def validate_description(self, value):
        return value.strip()

    def validate_main_deity(self, value):
        return " ".join(value.split())

    def validate_address(self, value):
        value = " ".join(value.split())

        if len(value) < 5:
            raise serializers.ValidationError(
                "Complete temple address enter cheyyandi."
            )

        return value

    def validate_image(self, value):
        if value is None:
            return value

        maximum_size = 5 * 1024 * 1024

        if value.size > maximum_size:
            raise serializers.ValidationError(
                "Temple image size 5 MB lopu undali."
            )

        allowed_content_types = {
            "image/jpeg",
            "image/png",
            "image/webp",
        }

        content_type = getattr(
            value,
            "content_type",
            "",
        )

        if (
            content_type
            and content_type not in allowed_content_types
        ):
            raise serializers.ValidationError(
                "JPG, PNG leda WEBP image upload cheyyandi."
            )

        return value


class TempleMemberListSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )

    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    full_name = serializers.SerializerMethodField()

    phone_number = serializers.CharField(
        source="user.phone_number",
        read_only=True,
        allow_null=True,
    )

    email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    role_display = serializers.CharField(
        source="get_role_display",
        read_only=True,
    )

    class Meta:
        model = TempleMember

        fields = [
            "id",
            "user_id",
            "username",
            "full_name",
            "phone_number",
            "email",
            "role",
            "role_display",
            "created_at",
        ]

        read_only_fields = fields

    def get_full_name(self, obj):
        full_name = obj.user.get_full_name().strip()

        return full_name or obj.user.username


class TempleMemberCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(
        max_length=150,
    )

    phone_number = serializers.CharField(
        max_length=10,
    )

    username = serializers.CharField(
        min_length=3,
        max_length=150,
    )

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
    )

    confirm_password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
    )

    role = serializers.ChoiceField(
        choices=(
            ("manager", "Manager"),
            ("editor", "Editor"),
        ),
    )

    def validate_full_name(self, value):
        value = " ".join(value.split())

        if len(value) < 2:
            raise serializers.ValidationError(
                "Member full name enter cheyyandi."
            )

        return value

    def validate_phone_number(self, value):
        value = value.strip()

        if not PHONE_PATTERN.fullmatch(value):
            raise serializers.ValidationError(
                "Valid 10-digit mobile number enter cheyyandi."
            )

        if User.objects.filter(
            phone_number=value,
        ).exists():
            raise serializers.ValidationError(
                "Ee mobile number tho account already undhi."
            )

        return value

    def validate_username(self, value):
        value = "_".join(
            value.strip().lower().split()
        )

        if not USERNAME_PATTERN.fullmatch(value):
            raise serializers.ValidationError(
                (
                    "Username lo letters, numbers and "
                    "_ @ . + - matrame use cheyyandi."
                )
            )

        if User.objects.filter(
            username__iexact=value,
        ).exists():
            raise serializers.ValidationError(
                "Ee username already use lo undhi."
            )

        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {
                    "confirm_password": (
                        "Passwords match avvatledhu."
                    )
                }
            )

        password_user = User(
            username=attrs["username"],
            phone_number=attrs["phone_number"],
            role="temple_member",
        )

        try:
            validate_password(
                attrs["password"],
                user=password_user,
            )
        except DjangoValidationError as error:
            raise serializers.ValidationError(
                {
                    "password": list(error.messages),
                }
            ) from error

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        temple = validated_data.pop("temple")
        full_name = validated_data.pop("full_name")
        confirm_password = validated_data.pop(
            "confirm_password"
        )
        del confirm_password

        role = validated_data.pop("role")
        password = validated_data.pop("password")

        name_parts = full_name.split(" ", 1)
        first_name = name_parts[0]
        last_name = (
            name_parts[1]
            if len(name_parts) > 1
            else ""
        )

        user = User.objects.create_user(
            username=validated_data["username"],
            password=password,
            phone_number=validated_data["phone_number"],
            first_name=first_name,
            last_name=last_name,
            role="temple_member",
        )

        return TempleMember.objects.create(
            temple=temple,
            user=user,
            role=role,
        )


class TempleMemberUpdateSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(
        max_length=150,
        write_only=True,
    )

    username = serializers.CharField(
        min_length=3,
        max_length=150,
        write_only=True,
    )

    phone_number = serializers.CharField(
        max_length=10,
        write_only=True,
    )

    role = serializers.ChoiceField(
        choices=(
            ("manager", "Manager"),
            ("editor", "Editor"),
        ),
    )

    class Meta:
        model = TempleMember

        fields = [
            "full_name",
            "username",
            "phone_number",
            "role",
        ]

    def validate_full_name(self, value):
        value = " ".join(value.split())

        if len(value) < 2:
            raise serializers.ValidationError(
                "Member full name enter cheyyandi."
            )

        return value

    def validate_username(self, value):
        value = "_".join(
            value.strip().lower().split()
        )

        if not USERNAME_PATTERN.fullmatch(value):
            raise serializers.ValidationError(
                (
                    "Username lo letters, numbers and "
                    "_ @ . + - matrame use cheyyandi."
                )
            )

        duplicate_user = User.objects.filter(
            username__iexact=value,
        ).exclude(
            pk=self.instance.user_id,
        ).exists()

        if duplicate_user:
            raise serializers.ValidationError(
                "Ee username already use lo undhi."
            )

        return value

    def validate_phone_number(self, value):
        value = value.strip()

        if not PHONE_PATTERN.fullmatch(value):
            raise serializers.ValidationError(
                "Valid 10-digit mobile number enter cheyyandi."
            )

        duplicate_user = User.objects.filter(
            phone_number=value,
        ).exclude(
            pk=self.instance.user_id,
        ).exists()

        if duplicate_user:
            raise serializers.ValidationError(
                "Ee mobile number tho account already undhi."
            )

        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        full_name = validated_data.pop("full_name", None)
        username = validated_data.pop("username", None)
        phone_number = validated_data.pop(
            "phone_number",
            None,
        )

        user_update_fields = []

        if full_name is not None:
            name_parts = full_name.split(" ", 1)
            instance.user.first_name = name_parts[0]
            instance.user.last_name = (
                name_parts[1]
                if len(name_parts) > 1
                else ""
            )

            user_update_fields.extend(
                ["first_name", "last_name"]
            )

        if username is not None:
            instance.user.username = username
            user_update_fields.append("username")

        if phone_number is not None:
            instance.user.phone_number = phone_number
            user_update_fields.append("phone_number")

        if user_update_fields:
            instance.user.save(
                update_fields=user_update_fields
            )

        role = validated_data.get("role")

        if role is not None:
            instance.role = role
            instance.save(
                update_fields=["role"]
            )

        return instance


class PublicTempleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Temple
        fields = [
            "id",
            "name",
            "description",
            "address",
            "city",
            "district",
            "state",
            "main_deity",
            "opening_time",
            "closing_time",
            "image",
            "latitude",
            "longitude",
        ]