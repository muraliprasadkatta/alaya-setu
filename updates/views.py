from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from temples.models import Temple, TempleMember

from .models import TempleUpdate
from .serializers import TempleAnnouncementSerializer


CONTENT_MANAGER_ROLES = {
    "owner",
    "manager",
}


def get_temple_membership(user, temple_id):
    return (
        TempleMember.objects
        .select_related(
            "temple",
            "temple__workspace",
            "temple__workspace__owner",
            "user",
        )
        .filter(
            temple_id=temple_id,
            temple__is_verified=True,
            user=user,
        )
        .first()
    )


def get_temple_access(user, temple_id):
    if user.is_superuser:
        temple = (
            Temple.objects
            .select_related(
                "workspace",
                "workspace__owner",
            )
            .filter(pk=temple_id)
            .first()
        )

        return temple, None

    membership = get_temple_membership(
        user,
        temple_id,
    )

    if membership is None:
        return None, None

    return membership.temple, membership


def get_announcement_visibility_filter(temple):
    if temple.workspace_id is None:
        return {
            "temple_id": temple.id,
        }

    return {
        "temple__workspace_id": temple.workspace_id,
    }


def get_user_memberships_by_temple(user, temple):
    if user.is_superuser:
        return {}

    memberships = (
        TempleMember.objects
        .select_related(
            "temple",
            "user",
        )
        .filter(
            temple__is_verified=True,
            user=user,
        )
    )

    if temple.workspace_id is None:
        memberships = memberships.filter(
            temple_id=temple.id,
        )
    else:
        memberships = memberships.filter(
            temple__workspace_id=temple.workspace_id,
        )

    return {
        membership.temple_id: membership
        for membership in memberships
    }


def get_serializer_context(
    request,
    temple,
    membership=None,
    memberships_by_temple_id=None,
):
    if memberships_by_temple_id is None:
        memberships_by_temple_id = {}

    workspace_owner_id = None

    if temple.workspace_id is not None:
        workspace_owner_id = temple.workspace.owner_id

    return {
        "request": request,
        "membership": membership,
        "memberships_by_temple_id": (
            memberships_by_temple_id
        ),
        "workspace_owner_id": workspace_owner_id,
    }


def can_manage_announcement(
    user,
    membership,
    announcement,
):
    if user.is_superuser:
        return True

    if (
        announcement.temple.workspace_id is not None
        and announcement.temple.workspace.owner_id
        == user.id
    ):
        return True

    if announcement.created_by_id == user.id:
        return True

    return (
        membership is not None
        and membership.temple_id
        == announcement.temple_id
        and membership.role in CONTENT_MANAGER_ROLES
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


def announcement_not_found_response():
    return Response(
        {
            "success": False,
            "message": "Announcement dorakaledhu.",
        },
        status=status.HTTP_404_NOT_FOUND,
    )


def announcement_permission_denied_response():
    return Response(
        {
            "success": False,
            "message": (
                "Ee announcement-ni edit/delete "
                "cheyyadaniki permission ledhu."
            ),
        },
        status=status.HTTP_403_FORBIDDEN,
    )


class TempleAnnouncementListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_access(self, request, temple_id):
        return get_temple_access(
            request.user,
            temple_id,
        )

    def get(self, request, temple_id):
        temple, membership = self.get_access(
            request,
            temple_id,
        )

        if temple is None:
            return temple_access_denied_response()

        announcements = (
            TempleUpdate.objects
            .filter(
                **get_announcement_visibility_filter(
                    temple,
                )
            )
            .select_related(
                "created_by",
                "temple",
                "temple__workspace",
                "temple__workspace__owner",
            )
            .order_by("-created_at")
        )

        memberships_by_temple_id = (
            get_user_memberships_by_temple(
                request.user,
                temple,
            )
        )

        serializer = TempleAnnouncementSerializer(
            announcements,
            many=True,
            context=get_serializer_context(
                request,
                temple,
                membership=membership,
                memberships_by_temple_id=(
                    memberships_by_temple_id
                ),
            ),
        )

        return Response(
            {
                "success": True,
                "can_create": True,
                "workspace_id": temple.workspace_id,
                "announcements": serializer.data,
                "count": announcements.count(),
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, temple_id):
        temple, membership = self.get_access(
            request,
            temple_id,
        )

        if temple is None:
            return temple_access_denied_response()

        serializer = TempleAnnouncementSerializer(
            data=request.data,
            context=get_serializer_context(
                request,
                temple,
                membership=membership,
                memberships_by_temple_id={
                    temple.id: membership,
                },
            ),
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": (
                        "Announcement details correct chesi "
                        "malli save cheyyandi."
                    ),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        announcement = serializer.save(
            temple=temple,
            created_by=request.user,
        )

        response_serializer = TempleAnnouncementSerializer(
            announcement,
            context=get_serializer_context(
                request,
                temple,
                membership=membership,
                memberships_by_temple_id={
                    temple.id: membership,
                },
            ),
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Announcement successfully create ayyindi."
                ),
                "announcement": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class TempleAnnouncementDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_context(
        self,
        request,
        temple_id,
        announcement_id,
    ):
        temple, access_membership = get_temple_access(
            request.user,
            temple_id,
        )

        if temple is None:
            return None, None, temple_access_denied_response()

        announcement = (
            TempleUpdate.objects
            .select_related(
                "created_by",
                "temple",
                "temple__workspace",
                "temple__workspace__owner",
            )
            .filter(
                pk=announcement_id,
                **get_announcement_visibility_filter(
                    temple,
                ),
            )
            .first()
        )

        if announcement is None:
            return (
                access_membership,
                None,
                announcement_not_found_response(),
            )

        membership = get_temple_membership(
            request.user,
            announcement.temple_id,
        )

        return membership, announcement, None

    def get(
        self,
        request,
        temple_id,
        announcement_id,
    ):
        membership, announcement, error_response = (
            self.get_context(
                request,
                temple_id,
                announcement_id,
            )
        )

        if error_response is not None:
            return error_response

        serializer = TempleAnnouncementSerializer(
            announcement,
            context=get_serializer_context(
                request,
                announcement.temple,
                membership=membership,
                memberships_by_temple_id={
                    announcement.temple_id: membership,
                },
            ),
        )

        return Response(
            {
                "success": True,
                "announcement": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def patch(
        self,
        request,
        temple_id,
        announcement_id,
    ):
        membership, announcement, error_response = (
            self.get_context(
                request,
                temple_id,
                announcement_id,
            )
        )

        if error_response is not None:
            return error_response

        if not can_manage_announcement(
            request.user,
            membership,
            announcement,
        ):
            return announcement_permission_denied_response()

        serializer = TempleAnnouncementSerializer(
            announcement,
            data=request.data,
            partial=True,
            context=get_serializer_context(
                request,
                announcement.temple,
                membership=membership,
                memberships_by_temple_id={
                    announcement.temple_id: membership,
                },
            ),
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": (
                        "Announcement details correct chesi "
                        "malli save cheyyandi."
                    ),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_announcement = serializer.save()

        response_serializer = TempleAnnouncementSerializer(
            updated_announcement,
            context=get_serializer_context(
                request,
                updated_announcement.temple,
                membership=membership,
                memberships_by_temple_id={
                    updated_announcement.temple_id: membership,
                },
            ),
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Announcement successfully update ayyindi."
                ),
                "announcement": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def delete(
        self,
        request,
        temple_id,
        announcement_id,
    ):
        membership, announcement, error_response = (
            self.get_context(
                request,
                temple_id,
                announcement_id,
            )
        )

        if error_response is not None:
            return error_response

        if not can_manage_announcement(
            request.user,
            membership,
            announcement,
        ):
            return announcement_permission_denied_response()

        announcement.delete()

        return Response(
            {
                "success": True,
                "message": (
                    "Announcement successfully delete ayyindi."
                ),
            },
            status=status.HTTP_200_OK,
        )


class PublicUpdateListView(APIView):
    """
    Devotee-facing (mobile app "Updates" tab) global feed — anni
    verified temples yokka published updates ni okate list గా
    isthundi. Events app లో `PublicEventListView` chesina అదే
    pattern.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        updates = (
            TempleUpdate.objects
            .filter(
                status="published",
                temple__is_verified=True,
            )
            .select_related("temple", "created_by")
            .order_by("-created_at")
        )

        serializer = TempleAnnouncementSerializer(
            updates,
            many=True,
            context={"request": request},
        )

        return Response(
            {
                "success": True,
                "announcements": serializer.data,
            },
            status=status.HTTP_200_OK,
        )