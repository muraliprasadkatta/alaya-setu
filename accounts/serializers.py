from django.contrib.auth import (
    authenticate,
    get_user_model,
)
from rest_framework import serializers
from rest_framework_simplejwt.tokens import (
    RefreshToken,
)


User = get_user_model()


class TempleAdminRegisterSerializer(
    serializers.ModelSerializer
):
    full_name = serializers.CharField(
        write_only=True,
    )

    password = serializers.CharField(
        write_only=True,
        min_length=6,
    )

    confirm_password = serializers.CharField(
        write_only=True,
        min_length=6,
    )

    class Meta:
        model = User

        fields = [
            "full_name",
            "phone_number",
            "email",
            "username",
            "password",
            "confirm_password",
        ]

    def validate(self, attrs):
        if (
            attrs["password"]
            != attrs["confirm_password"]
        ):
            raise serializers.ValidationError(
                {
                    "confirm_password": (
                        "Passwords do not match."
                    )
                }
            )

        if User.objects.filter(
            username=attrs["username"]
        ).exists():
            raise serializers.ValidationError(
                {
                    "username": (
                        "Username already exists."
                    )
                }
            )

        if (
            attrs.get("email")
            and User.objects.filter(
                email=attrs["email"]
            ).exists()
        ):
            raise serializers.ValidationError(
                {
                    "email": (
                        "Email already exists."
                    )
                }
            )

        return attrs

    def create(self, validated_data):
        full_name = validated_data.pop(
            "full_name"
        )

        validated_data.pop(
            "confirm_password"
        )

        name_parts = (
            full_name
            .strip()
            .split(" ", 1)
        )

        first_name = name_parts[0]

        last_name = (
            name_parts[1]
            if len(name_parts) > 1
            else ""
        )

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get(
                "email",
                "",
            ),
            password=validated_data["password"],
            phone_number=validated_data.get(
                "phone_number",
                "",
            ),
            first_name=first_name,
            last_name=last_name,

            # Temple permission approval
            # tarvatha matrame ivvali.
            role="pending_temple_admin",
        )

        return user


class TempleAdminLoginSerializer(
    serializers.Serializer
):
    username_or_email = serializers.CharField()

    password = serializers.CharField(
        write_only=True,
    )

    def validate(self, attrs):
        username_or_email = attrs[
            "username_or_email"
        ]

        password = attrs["password"]

        user_obj = User.objects.filter(
            username=username_or_email
        ).first()

        if user_obj is None:
            user_obj = User.objects.filter(
                email=username_or_email
            ).first()

        if user_obj is None:
            raise serializers.ValidationError(
                (
                    "Invalid username/email "
                    "or password."
                )
            )

        user = authenticate(
            username=user_obj.username,
            password=password,
        )

        if user is None:
            raise serializers.ValidationError(
                (
                    "Invalid username/email "
                    "or password."
                )
            )

        refresh = RefreshToken.for_user(user)

        return {
            "refresh": str(refresh),
            "access": str(
                refresh.access_token
            ),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": (
                    user.get_full_name()
                ),
                "phone_number": (
                    user.phone_number
                ),
                "role": user.role,
            },
        }


class UserProfileSerializer(
    serializers.ModelSerializer
):
    full_name = serializers.SerializerMethodField()

    role_display = serializers.CharField(
        source="get_role_display",
        read_only=True,
    )

    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )

    phone_number = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=15,
        trim_whitespace=True,
    )

    class Meta:
        model = User

        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone_number",
            "role",
            "role_display",
            "date_joined",
        )

        read_only_fields = (
            "id",
            "username",
            "full_name",
            "role",
            "role_display",
            "date_joined",
        )

    def get_full_name(self, user):
        return (
            user.get_full_name().strip()
            or user.username
        )

    def validate_first_name(self, value):
        value = " ".join(value.split())

        if len(value) < 2:
            raise serializers.ValidationError(
                (
                    "First name must contain "
                    "at least 2 characters."
                )
            )

        return value

    def validate_last_name(self, value):
        return " ".join(value.split())

    def validate_email(self, value):
        value = value.strip().lower()

        if not value:
            return ""

        existing_user = (
            User.objects
            .filter(email__iexact=value)
            .exclude(pk=self.instance.pk)
            .exists()
        )

        if existing_user:
            raise serializers.ValidationError(
                (
                    "This email is already used "
                    "by another account."
                )
            )

        return value

    def validate_phone_number(self, value):
        value = (value or "").strip()

        if not value:
            return ""

        if (
            len(value) != 10
            or not value.isdigit()
        ):
            raise serializers.ValidationError(
                (
                    "Enter a valid 10-digit "
                    "mobile number."
                )
            )

        existing_user = (
            User.objects
            .filter(phone_number=value)
            .exclude(pk=self.instance.pk)
            .exists()
        )

        if existing_user:
            raise serializers.ValidationError(
                (
                    "This mobile number is already "
                    "used by another account."
                )
            )

        return value


from .models import OTPRequest


def send_otp_sms(phone_number, code):
    """Dev-mode stub — production లో ఇక్కడ 2Factor/Firebase SMS API call పెట్టాలి."""
    print(f"[DEV OTP] {phone_number} -> {code}")


class SendOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)

    def validate_phone_number(self, value):
        value = value.strip()
        if len(value) != 10 or not value.isdigit():
            raise serializers.ValidationError(
                "Enter a valid 10-digit mobile number."
            )
        return value

    def create(self, validated_data):
        import random
        from datetime import timedelta
        from django.utils import timezone

        phone_number = validated_data["phone_number"]
        code = str(random.randint(100000, 999999))

        otp = OTPRequest.objects.create(
            phone_number=phone_number,
            code=code,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        send_otp_sms(phone_number, code)
        return otp


class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        phone_number = attrs["phone_number"].strip()
        code = attrs["code"].strip()

        otp = (
            OTPRequest.objects
            .filter(phone_number=phone_number, code=code, is_verified=False)
            .order_by("-created_at")
            .first()
        )

        if otp is None:
            raise serializers.ValidationError("Invalid OTP.")

        if otp.is_expired():
            raise serializers.ValidationError(
                "OTP expired. Please request a new one."
            )

        otp.is_verified = True
        otp.save()

        user, created = User.objects.get_or_create(
            phone_number=phone_number,
            defaults={
                "username": f"devotee_{phone_number}",
                "role": "devotee",
            },
        )

        if created:
            user.set_unusable_password()
            user.save()

        refresh = RefreshToken.for_user(user)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "needs_name": not bool(user.first_name),
            "user": {
                "id": user.id,
                "username": user.username,
                "phone_number": user.phone_number,
                "role": user.role,
                "name": user.first_name,
            },
        }

class SetDevoteeNameSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, min_length=2)

    def validate_name(self, value):
        return value.strip()