from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50

    def get_paginated_response(
        self,
        data,
        *,
        unread_count,
    ):
        return Response(
            {
                "success": True,
                "count": self.page.paginator.count,
                "unread_count": unread_count,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "notifications": data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get(
            "status",
            "all",
        )

        if status_filter not in {
            "all",
            "unread",
            "read",
        }:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Notification status must be "
                        "all, unread, or read."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        notifications = (
            Notification.objects
            .filter(recipient=request.user)
            .select_related("temple")
        )

        if status_filter == "unread":
            notifications = notifications.filter(
                is_read=False,
            )
        elif status_filter == "read":
            notifications = notifications.filter(
                is_read=True,
            )

        unread_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).count()

        paginator = NotificationPagination()

        page = paginator.paginate_queryset(
            notifications,
            request,
            view=self,
        )

        serializer = NotificationSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
            unread_count=unread_count,
        )


class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        unread_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).count()

        return Response(
            {
                "success": True,
                "unread_count": unread_count,
            },
            status=status.HTTP_200_OK,
        )


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, notification_id):
        notification = (
            Notification.objects
            .select_for_update()
            .select_related("temple")
            .filter(
                id=notification_id,
                recipient=request.user,
            )
            .first()
        )

        if notification is None:
            return Response(
                {
                    "success": False,
                    "message": "Notification not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        notification.mark_as_read()

        return Response(
            {
                "success": True,
                "notification": NotificationSerializer(
                    notification,
                ).data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_time = timezone.now()

        updated_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).update(
            is_read=True,
            read_at=current_time,
            updated_at=current_time,
        )

        return Response(
            {
                "success": True,
                "updated_count": updated_count,
                "unread_count": 0,
            },
            status=status.HTTP_200_OK,
        )