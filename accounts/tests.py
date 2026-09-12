from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase


User = get_user_model()


class UserProfileApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="profile_owner",
            password="strong-test-password",
            first_name="Profile",
            last_name="Owner",
            email="owner@example.com",
            phone_number="9876543210",
            role="temple_admin",
        )

        self.other_user = User.objects.create_user(
            username="other_owner",
            password="strong-test-password",
            email="other@example.com",
            phone_number="9876543211",
            role="temple_admin",
        )

        self.profile_url = reverse("profile")

    def test_login_is_required(self):
        response = self.client.get(
            self.profile_url
        )

        self.assertEqual(
            response.status_code,
            401,
        )

    def test_get_returns_current_user_profile(self):
        self.client.force_authenticate(
            user=self.user
        )

        response = self.client.get(
            self.profile_url
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertTrue(
            response.data["success"]
        )

        self.assertEqual(
            response.data["profile"]["username"],
            self.user.username,
        )

        self.assertEqual(
            response.data["profile"]["role"],
            "temple_admin",
        )

    def test_user_can_update_profile(self):
        self.client.force_authenticate(
            user=self.user
        )

        response = self.client.patch(
            self.profile_url,
            {
                "first_name": "Updated",
                "last_name": "Name",
                "email": "UPDATED@example.com",
                "phone_number": "9123456789",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.first_name,
            "Updated",
        )

        self.assertEqual(
            self.user.last_name,
            "Name",
        )

        self.assertEqual(
            self.user.email,
            "updated@example.com",
        )

        self.assertEqual(
            self.user.phone_number,
            "9123456789",
        )

    def test_username_and_role_cannot_be_changed(self):
        self.client.force_authenticate(
            user=self.user
        )

        response = self.client.patch(
            self.profile_url,
            {
                "username": "changed_username",
                "role": "super_admin",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.username,
            "profile_owner",
        )

        self.assertEqual(
            self.user.role,
            "temple_admin",
        )

    def test_invalid_phone_number_is_rejected(self):
        self.client.force_authenticate(
            user=self.user
        )

        response = self.client.patch(
            self.profile_url,
            {
                "phone_number": "12345",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            400,
        )

        self.assertIn(
            "phone_number",
            response.data["errors"],
        )

    def test_duplicate_email_is_rejected(self):
        self.client.force_authenticate(
            user=self.user
        )

        response = self.client.patch(
            self.profile_url,
            {
                "email": "OTHER@example.com",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            400,
        )

        self.assertIn(
            "email",
            response.data["errors"],
        )

    def test_duplicate_phone_number_is_rejected(self):
        self.client.force_authenticate(
            user=self.user
        )

        response = self.client.patch(
            self.profile_url,
            {
                "phone_number": "9876543211",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            400,
        )

        self.assertIn(
            "phone_number",
            response.data["errors"],
        )