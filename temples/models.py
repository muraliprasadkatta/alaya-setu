from django.conf import settings
from django.db import models
from django.db.models import Q


class TempleWorkspace(models.Model):
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="temple_workspace",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        owner_name = self.owner.get_full_name().strip()

        return (
            f"{owner_name or self.owner.username} "
            "Temple Workspace"
        )


class Temple(models.Model):
    workspace = models.ForeignKey(
        TempleWorkspace,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="temples",
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    address = models.TextField()
    city = models.CharField(max_length=100)

    district = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10, blank=True)

    pincode_location = models.ForeignKey(
        "PincodeLocation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="temples",
    )

    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
    )

    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
    )

    main_deity = models.CharField(max_length=100, blank=True)

    opening_time = models.TimeField(
        blank=True,
        null=True,
    )

    closing_time = models.TimeField(
        blank=True,
        null=True,
    )

    image = models.ImageField(
        upload_to="temples/",
        blank=True,
        null=True,
    )

    is_verified = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_temples",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class TempleMember(models.Model):
    ROLE_CHOICES = (
        ("owner", "Owner"),
        ("manager", "Manager"),
        ("editor", "Editor"),
    )

    temple = models.ForeignKey(
        Temple,
        on_delete=models.CASCADE,
        related_name="members",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="temple_memberships",
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="editor",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("temple", "user")

    def __str__(self):
        return (
            f"{self.user.username} - "
            f"{self.temple.name} ({self.role})"
        )


class TempleFollow(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="followed_temples",
    )

    temple = models.ForeignKey(
        Temple,
        on_delete=models.CASCADE,
        related_name="followers",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "temple")

    def __str__(self):
        return (
            f"{self.user.username} follows "
            f"{self.temple.name}"
        )


class TempleRequest(models.Model):
    REQUEST_TYPE_CHOICES = (
        ("new_temple", "New Temple"),
        ("claim_temple", "Claim Existing Temple"),
    )

    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    )

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="temple_requests",
    )

    request_type = models.CharField(
        max_length=20,
        choices=REQUEST_TYPE_CHOICES,
        default="new_temple",
    )

    existing_temple = models.ForeignKey(
        Temple,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="claim_requests",
    )

    resubmitted_from = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resubmissions",
    )

    temple_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    address = models.TextField()
    city = models.CharField(max_length=100)

    district = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10, blank=True)

    pincode_location = models.ForeignKey(
        "PincodeLocation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="temple_requests",
    )

    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
    )

    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
    )

    main_deity = models.CharField(max_length=100, blank=True)

    temple_image = models.ImageField(
        upload_to="temple_requests/temple_images/",
        blank=True,
        null=True,
    )

    opening_time = models.TimeField(
        blank=True,
        null=True,
    )

    closing_time = models.TimeField(
        blank=True,
        null=True,
    )

    contact_person_name = models.CharField(max_length=100)
    contact_phone = models.CharField(max_length=15)

    proof_image = models.ImageField(
        upload_to="temple_requests/",
        blank=True,
        null=True,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    admin_notes = models.TextField(blank=True)

    rejection_reason = models.TextField(
        blank=True,
        default="",
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_temple_requests",
    )

    approved_temple = models.ForeignKey(
        Temple,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_requests",
    )

    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.temple_name} - {self.status}"


class PincodeLocation(models.Model):
    circle_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    region_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    division_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    office_name = models.CharField(max_length=150)

    pincode = models.CharField(
        max_length=6,
        db_index=True,
    )

    office_type = models.CharField(
        max_length=20,
        blank=True,
        default="",
    )

    delivery_status = models.CharField(
        max_length=30,
        blank=True,
        default="",
    )

    district = models.CharField(
        max_length=100,
        db_index=True,
    )

    state = models.CharField(
        max_length=100,
        db_index=True,
    )

    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        blank=True,
        null=True,
    )

    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ["pincode", "office_name"]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "pincode",
                    "office_name",
                    "district",
                    "state",
                ],
                name="unique_pincode_office_location",
            )
        ]

        indexes = [
            models.Index(
                fields=["state", "district"],
                name="postal_state_dist_idx",
            )
        ]

    def __str__(self):
        return (
            f"{self.office_name} - "
            f"{self.district}, {self.state} "
            f"({self.pincode})"
        )


class TempleVerifiedEditRequest(models.Model):
    STATUS_CHOICES = (
        (
            "access_pending",
            "Edit Access Pending",
        ),
        (
            "edit_allowed",
            "Edit Access Approved",
        ),
        (
            "changes_pending",
            "Changes Pending Approval",
        ),
        (
            "approved",
            "Changes Approved",
        ),
        (
            "rejected",
            "Rejected",
        ),
    )

    REJECTED_STAGE_CHOICES = (
        (
            "access_request",
            "Edit Access Request",
        ),
        (
            "submitted_changes",
            "Submitted Changes",
        ),
    )

    temple = models.ForeignKey(
        Temple,
        on_delete=models.CASCADE,
        related_name="verified_edit_requests",
    )

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="requested_verified_temple_edits",
    )

    request_reason = models.TextField()

    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default="access_pending",
        db_index=True,
    )

    # Original verified details snapshot.
    original_name = models.CharField(
        max_length=255,
    )

    original_pincode = models.CharField(
        max_length=10,
        blank=True,
        default="",
    )

    original_city = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    original_district = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    original_state = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    original_pincode_location = models.ForeignKey(
        PincodeLocation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    original_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
    )

    original_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
    )

    # Values entered by the temple administrator
    # after edit access is approved.
    proposed_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    proposed_pincode = models.CharField(
        max_length=10,
        blank=True,
        default="",
    )

    proposed_city = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    proposed_district = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    proposed_state = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    proposed_pincode_location = models.ForeignKey(
        PincodeLocation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    proposed_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
    )

    proposed_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
    )

    # Super Admin review of the initial
    # edit-access request.
    access_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_verified_edit_access_requests",
    )

    access_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    # Super Admin review after the temple
    # administrator submits changed values.
    final_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_verified_temple_changes",
    )

    final_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    rejected_stage = models.CharField(
        max_length=30,
        choices=REJECTED_STAGE_CHOICES,
        blank=True,
        default="",
    )

    rejection_reason = models.TextField(
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

        constraints = [
            models.UniqueConstraint(
                fields=["temple"],
                condition=Q(
                    status__in=[
                        "access_pending",
                        "edit_allowed",
                        "changes_pending",
                    ]
                ),
                name=(
                    "unique_active_verified_edit_request_per_temple"
                ),
            )
        ]

        indexes = [
            models.Index(
                fields=["temple", "status"],
                name="temple_edit_status_idx",
            ),
            models.Index(
                fields=["status", "created_at"],
                name="edit_request_queue_idx",
            ),
        ]

    def save(self, *args, **kwargs):
        if self._state.adding:
            self.original_name = self.temple.name
            self.original_pincode = self.temple.pincode
            self.original_city = self.temple.city
            self.original_district = self.temple.district
            self.original_state = self.temple.state

            self.original_pincode_location = (
                self.temple.pincode_location
            )

            self.original_latitude = self.temple.latitude
            self.original_longitude = self.temple.longitude

        super().save(*args, **kwargs)

    @property
    def is_active(self):
        return self.status in {
            "access_pending",
            "edit_allowed",
            "changes_pending",
        }

    @property
    def can_submit_changes(self):
        return self.status == "edit_allowed"

    def get_changed_fields(self):
        field_pairs = {
            "name": (
                self.original_name,
                self.proposed_name,
            ),
            "pincode": (
                self.original_pincode,
                self.proposed_pincode,
            ),
            "city": (
                self.original_city,
                self.proposed_city,
            ),
            "district": (
                self.original_district,
                self.proposed_district,
            ),
            "state": (
                self.original_state,
                self.proposed_state,
            ),
            "pincode_location": (
                self.original_pincode_location_id,
                self.proposed_pincode_location_id,
            ),
            "latitude": (
                self.original_latitude,
                self.proposed_latitude,
            ),
            "longitude": (
                self.original_longitude,
                self.proposed_longitude,
            ),
        }

        return {
            field_name: {
                "old": old_value,
                "new": new_value,
            }
            for field_name, (
                old_value,
                new_value,
            ) in field_pairs.items()
            if old_value != new_value
        }

    def __str__(self):
        return (
            f"{self.temple.name} - "
            f"{self.get_status_display()}"
        )