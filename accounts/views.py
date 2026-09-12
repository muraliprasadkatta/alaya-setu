from rest_framework import status
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import (
    RefreshToken,
)

from .serializers import (
    SendOTPSerializer,
    SetDevoteeNameSerializer,
    TempleAdminLoginSerializer,
    TempleAdminRegisterSerializer,
    UserProfileSerializer,
    VerifyOTPSerializer,
)

class TempleAdminRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = TempleAdminRegisterSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.save()

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": (
                    "Temple admin account created "
                    "successfully."
                ),
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
            },
            status=status.HTTP_201_CREATED,
        )


class TempleAdminLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = TempleAdminLoginSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            serializer.validated_data,
            status=status.HTTP_200_OK,
        )


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(
            request.user
        )

        return Response(
            {
                "success": True,
                "profile": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        serializer = UserProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": (
                        "Profile details correct "
                        "chesi malli save cheyyandi."
                    ),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_user = serializer.save()

        return Response(
            {
                "success": True,
                "message": (
                    "Profile updated successfully."
                ),
                "profile": UserProfileSerializer(
                    updated_user
                ).data,
            },
            status=status.HTTP_200_OK,
        )

from django.conf import settings


class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp = serializer.save()

        response_data = {"message": "OTP sent successfully."}

        if settings.DEBUG:
            response_data["debug_otp_code"] = otp.code

        return Response(response_data, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            serializer.validated_data,
            status=status.HTTP_200_OK,
        )


class SetDevoteeNameView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SetDevoteeNameSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.first_name = serializer.validated_data["name"]
        request.user.save()

        return Response(
            {"success": True, "name": request.user.first_name},
            status=status.HTTP_200_OK,
        )