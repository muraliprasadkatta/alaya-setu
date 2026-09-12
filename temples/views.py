import math
import re
from django.db import transaction
from django.db.models import F, Q
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    PincodeLocation,
    Temple,
    TempleMember,
    TempleRequest,
    TempleVerifiedEditRequest,
)
from .serializers import (
    MyTempleSerializer,
    TempleManagementSerializer,
    TempleMemberCreateSerializer,
    TempleMemberListSerializer,
    TempleMemberUpdateSerializer,
    TempleRequestCreateSerializer,
    TempleRequestResubmitSerializer,
    TempleRequestStatusSerializer,
    TempleUpdateSerializer,
    TempleVerifiedEditAccessRequestSerializer,
    TempleVerifiedEditRequestSerializer,
    TempleVerifiedEditSubmitSerializer,
    can_resubmit_temple_request,
    PublicTempleSerializer,
)


PINCODE_PATTERN = re.compile(r"^[1-9][0-9]{5}$")

ALLOWED_TEMPLE_REQUEST_ROLES = {
    "pending_temple_admin",
    "temple_admin",
    "super_admin",
}


def user_can_manage_temple_requests(user):
    return (
        user.is_superuser
        or getattr(user, "role", "")
        in ALLOWED_TEMPLE_REQUEST_ROLES
    )


def calculate_distance_km(
    latitude_1,
    longitude_1,
    latitude_2,
    longitude_2,
):
    coordinates = (
        latitude_1,
        longitude_1,
        latitude_2,
        longitude_2,
    )

    if any(value is None for value in coordinates):
        return None

    latitude_1 = math.radians(float(latitude_1))
    longitude_1 = math.radians(float(longitude_1))
    latitude_2 = math.radians(float(latitude_2))
    longitude_2 = math.radians(float(longitude_2))

    latitude_difference = latitude_2 - latitude_1
    longitude_difference = longitude_2 - longitude_1

    haversine_value = (
        math.sin(latitude_difference / 2) ** 2
        + math.cos(latitude_1)
        * math.cos(latitude_2)
        * math.sin(longitude_difference / 2) ** 2
    )

    haversine_value = min(
        1,
        max(0, haversine_value),
    )

    central_angle = 2 * math.atan2(
        math.sqrt(haversine_value),
        math.sqrt(1 - haversine_value),
    )

    return round(
        6371.0088 * central_angle,
        2,
    )


def role_denied_response():
    return Response(
        {
            "success": False,
            "message": "Temple request access permission ledhu.",
        },
        status=status.HTTP_403_FORBIDDEN,
    )


class PincodeLookupView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, pincode):
        pincode = str(pincode).strip()

        if not PINCODE_PATTERN.fullmatch(pincode):
            return Response(
                {
                    "success": False,
                    "message": (
                        "Valid 6-digit Indian pincode enter cheyyandi."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        records = list(
            PincodeLocation.objects.filter(
                pincode=pincode
            )
            .values(
                "id",
                "office_name",
                "office_type",
                "delivery_status",
                "district",
                "state",
                "latitude",
                "longitude",
            )
            .order_by(
                "office_name",
                "district",
                "state",
            )
        )

        if not records:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Ee pincode ki location details dorakaledu. "
                        "Location manually enter cheyyandi."
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        first_record = records[0]

        states = sorted(
            {
                record["state"]
                for record in records
                if record["state"]
            },
            key=str.casefold,
        )

        districts = sorted(
            {
                record["district"]
                for record in records
                if record["district"]
            },
            key=str.casefold,
        )

        post_offices = sorted(
            {
                record["office_name"]
                for record in records
                if record["office_name"]
            },
            key=str.casefold,
        )

        location_options = []

        for record in records:
            location_options.append(
                {
                    "id": record["id"],
                    "office_name": record["office_name"],
                    "office_type": record["office_type"],
                    "delivery_status": record["delivery_status"],
                    "district": record["district"],
                    "state": record["state"],
                    "latitude": (
                        str(record["latitude"])
                        if record["latitude"] is not None
                        else None
                    ),
                    "longitude": (
                        str(record["longitude"])
                        if record["longitude"] is not None
                        else None
                    ),
                }
            )

        return Response(
            {
                "success": True,
                "pincode": pincode,
                "state": first_record["state"],
                "district": first_record["district"],
                "states": states,
                "districts": districts,
                "post_offices": post_offices,
                "location_options": location_options,
            },
            status=status.HTTP_200_OK,
        )


class VerifiedTempleListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_can_manage_temple_requests(request.user):
            return role_denied_response()

        location_id = str(
            request.query_params.get(
                "pincode_location",
                "",
            )
        ).strip()

        if not location_id.isdigit():
            return Response(
                {
                    "success": False,
                    "message": (
                        "Valid Post Office / Area select cheyyandi."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        location = PincodeLocation.objects.filter(
            pk=location_id
        ).first()

        if location is None:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Selected Post Office details dorakaledu."
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        temples = (
            Temple.objects.filter(
                is_verified=True,
            )
            .filter(
                Q(pincode_location=location)
                |
                Q(
                    pincode_location__isnull=True,
                    pincode=location.pincode,
                )
            )
            .exclude(
                members__user=request.user,
            )
            .select_related(
                "pincode_location",
            )
            .distinct()
        )

        temple_options = []

        for temple in temples:
            if temple.pincode_location_id == location.id:
                match_type = "selected_area"
            else:
                match_type = "same_pincode"

            distance_km = calculate_distance_km(
                location.latitude,
                location.longitude,
                temple.latitude,
                temple.longitude,
            )

            temple_options.append(
                {
                    "id": temple.id,
                    "name": temple.name,
                    "main_deity": temple.main_deity,
                    "city": temple.city,
                    "district": temple.district,
                    "state": temple.state,
                    "pincode": temple.pincode,
                    "match_type": match_type,
                    "distance_km": distance_km,
                }
            )

        temple_options.sort(
            key=lambda temple: (
                (
                    0
                    if temple["match_type"] == "selected_area"
                    else 1
                ),
                temple["distance_km"] is None,
                temple["distance_km"] or 0,
                temple["name"].casefold(),
            )
        )

        return Response(
            {
                "success": True,
                "selected_location": {
                    "id": location.id,
                    "office_name": location.office_name,
                    "district": location.district,
                    "state": location.state,
                    "pincode": location.pincode,
                },
                "temples": temple_options,
                "count": len(temple_options),
            },
            status=status.HTTP_200_OK,
        )


class TempleRequestCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not user_can_manage_temple_requests(request.user):
            return role_denied_response()

        serializer = TempleRequestCreateSerializer(
            data=request.data,
            context={
                "request": request,
            },
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": (
                        "Form details correct chesi "
                        "malli submit cheyyandi."
                    ),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # request_type frontend nunchi vastundi:
        # new_temple or claim_temple
        temple_request = serializer.save(
            submitted_by=request.user,
        )

        response_serializer = TempleRequestCreateSerializer(
            temple_request
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Temple request successfully submit ayyindi. "
                    "Admin verification pending."
                ),
                "temple_request": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )



class TempleRequestResubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def get_original_request(
        self,
        request,
        request_id,
        lock=False,
    ):
        queryset = (
            TempleRequest.objects
            .select_related(
                "existing_temple",
                "pincode_location",
                "submitted_by",
            )
            .filter(
                pk=request_id,
                submitted_by=request.user,
            )
        )

        if lock:
            queryset = queryset.select_for_update()

        return queryset.first()

    def validate_resubmission(self, temple_request):
        if temple_request.status != "rejected":
            return Response(
                {
                    "success": False,
                    "message": (
                        "Rejected temple request-ni matrame "
                        "resubmit cheyyavachu."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not can_resubmit_temple_request(
            temple_request
        ):
            return Response(
                {
                    "success": False,
                    "message": (
                        "Ee request already resubmit ayyindi. "
                        "Latest request status check cheyyandi."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        return None

    def get(self, request, request_id):
        if not user_can_manage_temple_requests(
            request.user
        ):
            return role_denied_response()

        original_request = self.get_original_request(
            request,
            request_id,
        )

        if original_request is None:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Temple request dorakaledhu leda "
                        "meeku ee request access ledhu."
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        error_response = self.validate_resubmission(
            original_request
        )

        if error_response is not None:
            return error_response

        serializer = TempleRequestResubmitSerializer(
            original_request,
            context={
                "request": request,
                "original_request": original_request,
            },
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Rejected request details successfully "
                    "load ayyayi."
                ),
                "temple_request": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, request_id):
        if not user_can_manage_temple_requests(
            request.user
        ):
            return role_denied_response()

        with transaction.atomic():
            original_request = self.get_original_request(
                request,
                request_id,
                lock=True,
            )

            if original_request is None:
                return Response(
                    {
                        "success": False,
                        "message": (
                            "Temple request dorakaledhu leda "
                            "meeku ee request access ledhu."
                        ),
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            error_response = self.validate_resubmission(
                original_request
            )

            if error_response is not None:
                return error_response

            serializer = TempleRequestResubmitSerializer(
                data=request.data,
                context={
                    "request": request,
                    "original_request": original_request,
                },
            )

            if not serializer.is_valid():
                return Response(
                    {
                        "success": False,
                        "message": (
                            "Corrected request details check "
                            "chesi malli submit cheyyandi."
                        ),
                        "errors": serializer.errors,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            new_request = serializer.save(
                submitted_by=request.user,
                resubmitted_from=original_request,
                status="pending",
            )

        response_serializer = (
            TempleRequestResubmitSerializer(
                new_request,
                context={
                    "request": request,
                    "original_request": original_request,
                },
            )
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Corrected temple request successfully "
                    "resubmit ayyindi. Admin verification pending."
                ),
                "temple_request": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


        
class MyTempleRequestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_can_manage_temple_requests(request.user):
            return role_denied_response()

        temple_requests = TempleRequest.objects.filter(
            submitted_by=request.user,
        ).order_by(
            "-created_at",
        )

        serializer = TempleRequestStatusSerializer(
            temple_requests,
            many=True,
        )

        serialized_requests = serializer.data

        dashboard_request = next(
            (
                temple_request
                for temple_request in serialized_requests
                if temple_request["status"]
                in {
                    "pending",
                    "rejected",
                }
            ),
            None,
        )

        return Response(
            {
                "success": True,
                "latest_request": dashboard_request,
                "requests": serialized_requests,
                "count": len(serialized_requests),
            },
            status=status.HTTP_200_OK,
        )


class MyTempleListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        temples = (
            Temple.objects.filter(
                members__user=request.user,
                is_verified=True,
            )
            .annotate(
                membership_role=F("members__role"),
            )
            .order_by("name")
        )

        serializer = MyTempleSerializer(
            temples,
            many=True,
            context={
                "request": request,
            },
        )

        serialized_temples = serializer.data

        return Response(
            {
                "success": True,
                "temples": serialized_temples,
                "count": len(serialized_temples),
            },
            status=status.HTTP_200_OK,
        )


class TempleManagementDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_membership(self, request, temple_id):
        return (
            TempleMember.objects
            .select_related("temple")
            .prefetch_related("temple__members")
            .filter(
                temple_id=temple_id,
                temple__is_verified=True,
                user=request.user,
            )
            .first()
        )

    def get(self, request, temple_id):
        membership = self.get_membership(
            request,
            temple_id,
        )

        if membership is None:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Temple dorakaledhu leda "
                        "meeku ee temple access ledhu."
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TempleManagementSerializer(
            membership.temple,
            context={
                "request": request,
                "membership": membership,
            },
        )

        return Response(
            {
                "success": True,
                "temple": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request, temple_id):
        membership = self.get_membership(
            request,
            temple_id,
        )

        if membership is None:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Temple dorakaledhu leda "
                        "meeku ee temple access ledhu."
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if membership.role != "owner":
            return Response(
                {
                    "success": False,
                    "message": (
                        "Temple owner matrame temple details-ni "
                        "edit cheyyagalaru."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TempleUpdateSerializer(
            membership.temple,
            data=request.data,
            partial=True,
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": (
                        "Temple details correct chesi "
                        "malli save cheyyandi."
                    ),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer.save()

        response_serializer = TempleManagementSerializer(
            membership.temple,
            context={
                "request": request,
                "membership": membership,
            },
        )

        return Response(
            {
                "success": True,
                "message": "Temple details successfully update ayyayi.",
                "temple": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )


def get_temple_membership(user, temple_id):
    return (
        TempleMember.objects
        .select_related(
            "temple",
            "user",
        )
        .filter(
            temple_id=temple_id,
            temple__is_verified=True,
            user=user,
        )
        .first()
    )


def temple_access_denied_response():
    return Response(
        {
            "success": False,
            "message": (
                "Temple dorakaledhu leda "
                "meeku ee temple access ledhu."
            ),
        },
        status=status.HTTP_404_NOT_FOUND,
    )


def owner_permission_denied_response():
    return Response(
        {
            "success": False,
            "message": (
                "Temple owner matrame members-ni "
                "manage cheyyagalaru."
            ),
        },
        status=status.HTTP_403_FORBIDDEN,
    )


def verified_edit_owner_permission_denied_response():
    return Response(
        {
            "success": False,
            "message": (
                "Temple owner matrame verified details edit "
                "request-ni manage cheyyagalaru."
            ),
        },
        status=status.HTTP_403_FORBIDDEN,
    )


def get_verified_edit_owner_membership(
    request,
    temple_id,
):
    membership = get_temple_membership(
        request.user,
        temple_id,
    )

    if membership is None:
        return None, temple_access_denied_response()

    if membership.role != "owner":
        return (
            None,
            verified_edit_owner_permission_denied_response(),
        )

    return membership, None


class TempleVerifiedEditRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, temple_id):
        membership, error_response = (
            get_verified_edit_owner_membership(
                request,
                temple_id,
            )
        )

        if error_response is not None:
            return error_response

        edit_request = (
            TempleVerifiedEditRequest.objects
            .select_related(
                "temple",
                "requested_by",
                "original_pincode_location",
                "proposed_pincode_location",
            )
            .filter(
                temple=membership.temple,
            )
            .order_by("-created_at")
            .first()
        )

        if edit_request is None:
            return Response(
                {
                    "success": True,
                    "edit_request": None,
                },
                status=status.HTTP_200_OK,
            )

        serializer = TempleVerifiedEditRequestSerializer(
            edit_request,
            context={
                "request": request,
            },
        )

        return Response(
            {
                "success": True,
                "edit_request": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, temple_id):
        membership, error_response = (
            get_verified_edit_owner_membership(
                request,
                temple_id,
            )
        )

        if error_response is not None:
            return error_response

        serializer = TempleVerifiedEditAccessRequestSerializer(
            data=request.data,
            context={
                "request": request,
            },
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": (
                        "Edit request details correct chesi "
                        "malli submit cheyyandi."
                    ),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        edit_request = serializer.save(
            temple=membership.temple,
            requested_by=request.user,
        )

        response_serializer = (
            TempleVerifiedEditRequestSerializer(
                edit_request,
                context={
                    "request": request,
                },
            )
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Verified details edit request successfully "
                    "submit ayyindi. Super admin approval pending."
                ),
                "edit_request": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class TempleVerifiedEditSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, temple_id):
        membership, error_response = (
            get_verified_edit_owner_membership(
                request,
                temple_id,
            )
        )

        if error_response is not None:
            return error_response

        edit_request = (
            TempleVerifiedEditRequest.objects
            .select_related(
                "temple",
                "requested_by",
                "original_pincode_location",
                "proposed_pincode_location",
            )
            .filter(
                temple=membership.temple,
            )
            .order_by("-created_at")
            .first()
        )

        if edit_request is None:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Verified details edit request dorakaledhu."
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TempleVerifiedEditSubmitSerializer(
            edit_request,
            data=request.data,
            context={
                "request": request,
            },
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": (
                        "Verified details correct chesi "
                        "malli submit cheyyandi."
                    ),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_edit_request = serializer.save()

        response_serializer = (
            TempleVerifiedEditRequestSerializer(
                updated_edit_request,
                context={
                    "request": request,
                },
            )
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Verified detail changes successfully submit "
                    "ayyayi. Final super admin approval pending."
                ),
                "edit_request": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class TempleMemberListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, temple_id):
        membership = get_temple_membership(
            request.user,
            temple_id,
        )

        if membership is None:
            return temple_access_denied_response()

        members = (
            TempleMember.objects
            .filter(
                temple=membership.temple,
            )
            .select_related("user")
            .order_by(
                "created_at",
                "user__username",
            )
        )

        serializer = TempleMemberListSerializer(
            members,
            many=True,
        )

        return Response(
            {
                "success": True,
                "can_manage_members": (
                    membership.role == "owner"
                ),
                "members": serializer.data,
                "count": members.count(),
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, temple_id):
        membership = get_temple_membership(
            request.user,
            temple_id,
        )

        if membership is None:
            return temple_access_denied_response()

        if membership.role != "owner":
            return owner_permission_denied_response()

        serializer = TempleMemberCreateSerializer(
            data=request.data,
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": (
                        "Member details correct chesi "
                        "malli submit cheyyandi."
                    ),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        temple_member = serializer.save(
            temple=membership.temple,
        )

        response_serializer = TempleMemberListSerializer(
            temple_member,
        )

        return Response(
            {
                "success": True,
                "message": "Temple member successfully add ayyaru.",
                "member": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class TempleMemberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_owner_membership(self, request, temple_id):
        membership = get_temple_membership(
            request.user,
            temple_id,
        )

        if membership is None:
            return None, temple_access_denied_response()

        if membership.role != "owner":
            return None, owner_permission_denied_response()

        return membership, None

    def get_target_member(self, membership, member_id):
        return (
            TempleMember.objects
            .select_related("user")
            .filter(
                pk=member_id,
                temple=membership.temple,
            )
            .first()
        )

    def patch(self, request, temple_id, member_id):
        membership, error_response = (
            self.get_owner_membership(
                request,
                temple_id,
            )
        )

        if error_response is not None:
            return error_response

        target_member = self.get_target_member(
            membership,
            member_id,
        )

        if target_member is None:
            return Response(
                {
                    "success": False,
                    "message": "Temple member dorakaledhu.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if target_member.role == "owner":
            return Response(
                {
                    "success": False,
                    "message": "Owner role-ni change cheyyakudadhu.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TempleMemberUpdateSerializer(
            target_member,
            data=request.data,
            partial=True,
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": "Member details correct cheyyandi.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_member = serializer.save()

        response_serializer = TempleMemberListSerializer(
            updated_member,
        )

        return Response(
            {
                "success": True,
                "message": "Member details successfully update ayyayi.",
                "member": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, temple_id, member_id):
        membership, error_response = (
            self.get_owner_membership(
                request,
                temple_id,
            )
        )

        if error_response is not None:
            return error_response

        target_member = self.get_target_member(
            membership,
            member_id,
        )

        if target_member is None:
            return Response(
                {
                    "success": False,
                    "message": "Temple member dorakaledhu.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if target_member.role == "owner":
            return Response(
                {
                    "success": False,
                    "message": "Temple owner-ni remove cheyyakudadhu.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        removed_member_name = (
            target_member.user.get_full_name().strip()
            or target_member.user.username
        )

        target_member.delete()

        return Response(
            {
                "success": True,
                "message": (
                    f"{removed_member_name} temple access "
                    "successfully remove ayyindi."
                ),
            },
            status=status.HTTP_200_OK,
        )


class PublicTempleListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        temples = Temple.objects.filter(is_verified=True)

        city = request.query_params.get("city", "").strip()
        if city:
            temples = temples.filter(city__icontains=city)

        serializer = PublicTempleSerializer(temples, many=True)
        return Response(
            {"success": True, "temples": serializer.data},
            status=status.HTTP_200_OK,
        )


class PublicTempleDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, temple_id):
        temple = Temple.objects.filter(
            pk=temple_id, is_verified=True
        ).first()

        if temple is None:
            return Response(
                {"success": False, "message": "Temple dorakaledhu."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PublicTempleSerializer(temple)
        return Response(
            {"success": True, "temple": serializer.data},
            status=status.HTTP_200_OK,
        )

class PublicCityListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()

        cities_qs = (
            Temple.objects
            .filter(is_verified=True)
            .exclude(city="")
        )

        if query:
            cities_qs = cities_qs.filter(city__icontains=query)

        cities = (
            cities_qs
            .values_list("city", flat=True)
            .distinct()
            .order_by("city")[:20]
        )

        return Response(
            {"success": True, "cities": list(cities)},
            status=status.HTTP_200_OK,
        )