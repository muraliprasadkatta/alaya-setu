from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Notification
from .services import create_notification


User = get_user_model()


class NotificationApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="notification_owner",
            password="strong-test-password",
        )

        self.other_user = User.objects.create_user(
            username="another_owner",
            password="strong-test-password",
        )

        self.user_notification = Notification.objects.create(
            recipient=self.user,
            notification_type="temple_request_approved",
            title="Temple request approved",
            message="Your temple request was approved.",
            reference_type="temple_request",
            reference_id=1,
            action_data={
                "action": "open_temple_request",
                "request_id": 1,
            },
            web_action_url="/temple-admin-dashboard",
            event_key="test:user-one:approved",
        )

        self.other_notification = Notification.objects.create(
            recipient=self.other_user,
            notification_type="temple_request_rejected",
            title="Temple request rejected",
            message="Another user notification.",
            reference_type="temple_request",
            reference_id=2,
            action_data={
                "action": "open_temple_request",
                "request_id": 2,
            },
            web_action_url="/temple-admin-dashboard",
            event_key="test:user-two:rejected",
        )

    def test_login_is_required_to_view_notifications(self):
        response = self.client.get(
            reverse("notifications:list")
        )

        self.assertEqual(response.status_code, 401)

    def test_list_returns_only_current_user_notifications(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            reverse("notifications:list")
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["unread_count"], 1)

        notifications = response.data["notifications"]

        self.assertEqual(len(notifications), 1)
        self.assertEqual(
            notifications[0]["id"],
            self.user_notification.id,
        )

    def test_unread_count_returns_current_user_count(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            reverse("notifications:unread-count")
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["unread_count"], 1)

    def test_user_can_mark_own_notification_read(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            reverse(
                "notifications:mark-read",
                args=[self.user_notification.id],
            ),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.user_notification.refresh_from_db()

        self.assertTrue(self.user_notification.is_read)
        self.assertIsNotNone(self.user_notification.read_at)

    def test_user_cannot_mark_another_user_notification_read(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            reverse(
                "notifications:mark-read",
                args=[self.other_notification.id],
            ),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 404)

        self.other_notification.refresh_from_db()

        self.assertFalse(self.other_notification.is_read)

    def test_mark_all_read_updates_only_current_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("notifications:read-all"),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated_count"], 1)

        self.user_notification.refresh_from_db()
        self.other_notification.refresh_from_db()

        self.assertTrue(self.user_notification.is_read)
        self.assertFalse(self.other_notification.is_read)

    def test_invalid_status_filter_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            reverse("notifications:list"),
            {
                "status": "unknown",
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_event_key_prevents_duplicate_notifications(self):
        first_notification = create_notification(
            recipient=self.user,
            notification_type="temple_request_rejected",
            title="Rejected",
            message="Reason included.",
            event_key="test:idempotent-event",
            reference_type="temple_request",
            reference_id=10,
        )

        second_notification = create_notification(
            recipient=self.user,
            notification_type="temple_request_rejected",
            title="Rejected",
            message="Reason included.",
            event_key="test:idempotent-event",
            reference_type="temple_request",
            reference_id=10,
        )

        self.assertEqual(
            first_notification.id,
            second_notification.id,
        )

        self.assertEqual(
            Notification.objects.filter(
                event_key="test:idempotent-event",
            ).count(),
            1,
        )