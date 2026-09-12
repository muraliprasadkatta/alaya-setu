from django import forms
from django.contrib import admin, messages
from django.contrib.admin.helpers import ActionForm
from django.db import transaction
from django.utils import timezone

from notifications.services import (
    notify_temple_request_approved,
    notify_temple_request_rejected,
)

from .forms import TempleAdminForm
from .models import (
    PincodeLocation,
    Temple,
    TempleFollow,
    TempleMember,
    TempleRequest,
    TempleVerifiedEditRequest,
    TempleWorkspace,
)


def get_or_create_workspace(owner):
    if owner is None or owner.is_superuser:
        return None

    workspace, _ = TempleWorkspace.objects.get_or_create(
        owner=owner,
    )

    return workspace


class TempleMemberInline(admin.TabularInline):
    model = TempleMember
    extra = 0


class TempleRequestActionForm(ActionForm):
    rejection_reason = forms.CharField(
        required=False,
        label="Rejection reason",
        widget=forms.TextInput(
            attrs={
                "placeholder": (
                    "Reject action-ki reason enter cheyyandi"
                ),
                "size": 42,
            }
        ),
    )


@admin.register(PincodeLocation)
class PincodeLocationAdmin(admin.ModelAdmin):
    list_display = (
        "pincode",
        "office_name",
        "district",
        "state",
        "delivery_status",
    )

    search_fields = (
        "^pincode",
        "^office_name",
        "^district",
        "^state",
    )

    ordering = (
        "pincode",
        "office_name",
    )

    list_per_page = 50
    show_full_result_count = False


@admin.register(Temple)
class TempleAdmin(admin.ModelAdmin):
    form = TempleAdminForm

    autocomplete_fields = (
        "pincode_location",
    )

    list_display = (
        "name",
        "city",
        "district",
        "state",
        "pincode",
        "main_deity",
        "is_verified",
        "created_at",
    )

    list_filter = (
        "is_verified",
        "state",
        "district",
        "city",
    )

    search_fields = (
        "name",
        "main_deity",
        "pincode",
        "pincode_location__office_name",
        "city",
        "district",
        "state",
    )

    list_select_related = (
        "pincode_location",
        "created_by",
    )

    inlines = [TempleMemberInline]

    fieldsets = (
        (
            "Temple details",
            {
                "fields": (
                    "name",
                    "main_deity",
                    "description",
                    "image",
                    "is_verified",
                )
            },
        ),
        (
            "Temple location",
            {
                "fields": (
                    "pincode",
                    "pincode_location",
                    ("state", "district", "city"),
                    "address",
                    ("latitude", "longitude"),
                )
            },
        ),
        (
            "Temple timings",
            {
                "fields": (
                    ("opening_time", "closing_time"),
                )
            },
        ),
        (
            "Ownership",
            {
                "fields": (
                    "created_by",
                )
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        if obj.created_by_id is None:
            obj.created_by = request.user

        if obj.workspace_id is None:
            obj.workspace = get_or_create_workspace(
                obj.created_by,
            )

        super().save_model(
            request,
            obj,
            form,
            change,
        )

    class Media:
        js = (
            "temples/js/temple_admin_location.js",
        )


@admin.register(TempleMember)
class TempleMemberAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "temple",
        "role",
        "created_at",
    )

    list_filter = ("role",)

    search_fields = (
        "user__username",
        "temple__name",
    )

    list_select_related = (
        "user",
        "temple",
    )


@admin.register(TempleFollow)
class TempleFollowAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "temple",
        "created_at",
    )

    search_fields = (
        "user__username",
        "temple__name",
    )

    list_select_related = (
        "user",
        "temple",
    )


@admin.register(TempleRequest)
class TempleRequestAdmin(admin.ModelAdmin):
    action_form = TempleRequestActionForm

    autocomplete_fields = (
        "submitted_by",
        "existing_temple",
        "pincode_location",
    )

    list_display = (
        "temple_name",
        "submitted_by",
        "request_type",
        "city",
        "district",
        "state",
        "status",
        "created_at",
    )

    list_filter = (
        "status",
        "request_type",
        "state",
        "district",
        "city",
        "created_at",
    )

    search_fields = (
        "temple_name",
        "submitted_by__username",
        "contact_person_name",
        "contact_phone",
        "pincode",
        "city",
        "district",
        "state",
    )

    list_select_related = (
        "submitted_by",
        "existing_temple",
        "pincode_location",
        "approved_temple",
        "reviewed_by",
    )

    readonly_fields = (
        "status",
        "rejection_reason",
        "reviewed_by",
        "approved_temple",
        "reviewed_at",
        "created_at",
        "updated_at",
    )

    actions = (
        "approve_requests",
        "reject_requests",
    )

    @admin.action(
        description="Approve selected temple requests"
    )
    def approve_requests(self, request, queryset):
        approved_count = 0
        skipped_count = 0

        request_ids = list(
            queryset.values_list(
                "pk",
                flat=True,
            )
        )

        for request_id in request_ids:
            with transaction.atomic():
                temple_request = (
                    TempleRequest.objects
                    .select_for_update()
                    .select_related(
                        "submitted_by",
                        "existing_temple",
                        "pincode_location",
                    )
                    .get(pk=request_id)
                )

                if temple_request.status != "pending":
                    skipped_count += 1
                    continue

                workspace = get_or_create_workspace(
                    temple_request.submitted_by,
                )

                if workspace is None:
                    skipped_count += 1

                    self.message_user(
                        request,
                        (
                            f"{temple_request.temple_name}: "
                            "request owner workspace create "
                            "cheyyalekapoyam."
                        ),
                        messages.WARNING,
                    )
                    continue

                if (
                    temple_request.request_type
                    == "claim_temple"
                ):
                    temple = (
                        temple_request.existing_temple
                    )

                    if (
                        temple is None
                        or not temple.is_verified
                    ):
                        skipped_count += 1

                        self.message_user(
                            request,
                            (
                                f"{temple_request.temple_name}: "
                                "verified existing temple "
                                "select cheyyali."
                            ),
                            messages.WARNING,
                        )
                        continue

                    if (
                        temple.workspace_id is not None
                        and temple.workspace_id
                        != workspace.id
                    ):
                        skipped_count += 1

                        self.message_user(
                            request,
                            (
                                f"{temple_request.temple_name}: "
                                "ee temple already vere admin "
                                "workspace-ki assign ayindi."
                            ),
                            messages.WARNING,
                        )
                        continue

                    if temple.workspace_id is None:
                        temple.workspace = workspace
                        temple.save(
                            update_fields=[
                                "workspace",
                                "updated_at",
                            ]
                        )

                else:
                    duplicate_temple = (
                        Temple.objects.filter(
                            name__iexact=(
                                temple_request
                                .temple_name
                                .strip()
                            ),
                            pincode=(
                                temple_request.pincode
                            ),
                        )
                        .first()
                    )

                    if duplicate_temple is not None:
                        skipped_count += 1

                        self.message_user(
                            request,
                            (
                                f"{temple_request.temple_name}: "
                                "matching temple already exists. "
                                "Claim Existing Temple request "
                                "use cheyyandi."
                            ),
                            messages.WARNING,
                        )
                        continue

                    temple = Temple.objects.create(
                        name=(
                            temple_request
                            .temple_name
                            .strip()
                        ),
                        description=(
                            temple_request
                            .description
                            .strip()
                        ),
                        address=(
                            temple_request
                            .address
                            .strip()
                        ),
                        city=(
                            temple_request
                            .city
                            .strip()
                        ),
                        district=(
                            temple_request
                            .district
                            .strip()
                        ),
                        state=(
                            temple_request
                            .state
                            .strip()
                        ),
                        pincode=(
                            temple_request
                            .pincode
                            .strip()
                        ),
                        pincode_location=(
                            temple_request
                            .pincode_location
                        ),
                        latitude=temple_request.latitude,
                        longitude=temple_request.longitude,
                        main_deity=(
                            temple_request
                            .main_deity
                            .strip()
                        ),
                        opening_time=(
                            temple_request.opening_time
                        ),
                        closing_time=(
                            temple_request.closing_time
                        ),
                        image=(
                            temple_request.temple_image
                        ),
                        is_verified=True,
                        created_by=(
                            temple_request.submitted_by
                        ),
                        workspace=workspace,
                    )

                TempleMember.objects.update_or_create(
                    temple=temple,
                    user=temple_request.submitted_by,
                    defaults={
                        "role": "owner",
                    },
                )

                submitted_by = (
                    temple_request.submitted_by
                )

                if (
                    not submitted_by.is_superuser
                    and submitted_by.role
                    not in {
                        "temple_admin",
                        "super_admin",
                    }
                ):
                    submitted_by.role = "temple_admin"
                    submitted_by.save(
                        update_fields=["role"]
                    )

                temple_request.status = "approved"
                temple_request.reviewed_by = request.user
                temple_request.reviewed_at = (
                    timezone.now()
                )
                temple_request.approved_temple = temple

                temple_request.save(
                    update_fields=[
                        "status",
                        "reviewed_by",
                        "reviewed_at",
                        "approved_temple",
                        "updated_at",
                    ]
                )

                notify_temple_request_approved(
                    temple_request,
                )

                approved_count += 1

        if approved_count:
            self.message_user(
                request,
                (
                    f"{approved_count} temple request(s) "
                    "approved successfully."
                ),
                messages.SUCCESS,
            )

        if skipped_count:
            self.message_user(
                request,
                (
                    f"{skipped_count} request(s) skipped. "
                    "Already processed or details incomplete."
                ),
                messages.WARNING,
            )

    @admin.action(
        description="Reject selected temple requests"
    )
    def reject_requests(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request,
                (
                    "Reject cheyyadaniki exactly one "
                    "temple request select cheyyandi."
                ),
                messages.ERROR,
            )
            return

        rejection_reason = str(
            request.POST.get(
                "rejection_reason",
                "",
            )
        ).strip()

        if not rejection_reason:
            self.message_user(
                request,
                "Reject cheyyadaniki reason compulsory.",
                messages.ERROR,
            )
            return

        temple_request_id = queryset.values_list(
            "pk",
            flat=True,
        ).first()

        with transaction.atomic():
            temple_request = (
                TempleRequest.objects
                .select_for_update()
                .get(pk=temple_request_id)
            )

            if temple_request.status != "pending":
                self.message_user(
                    request,
                    "Pending temple request select cheyyandi.",
                    messages.ERROR,
                )
                return

            reviewed_at = timezone.now()

            temple_request.status = "rejected"
            temple_request.rejection_reason = rejection_reason
            temple_request.reviewed_by = request.user
            temple_request.reviewed_at = reviewed_at

            temple_request.save(
                update_fields=[
                    "status",
                    "rejection_reason",
                    "reviewed_by",
                    "reviewed_at",
                    "updated_at",
                ]
            )

            notify_temple_request_rejected(
                temple_request,
            )

        self.message_user(
            request,
            (
                f"{temple_request.temple_name} request "
                "rejected successfully."
            ),
            messages.WARNING,
        )


class TempleVerifiedEditRequestActionForm(ActionForm):
    rejection_reason = forms.CharField(
        required=False,
        label="Rejection reason",
        widget=forms.TextInput(
            attrs={
                "placeholder": (
                    "Reject action-ki reason enter cheyyandi"
                ),
                "size": 50,
            }
        ),
    )


@admin.register(TempleVerifiedEditRequest)
class TempleVerifiedEditRequestAdmin(admin.ModelAdmin):
    action_form = TempleVerifiedEditRequestActionForm

    list_display = (
        "temple",
        "requested_by",
        "status",
        "requested_changes",
        "created_at",
        "access_reviewed_at",
        "submitted_at",
        "final_reviewed_at",
    )

    list_filter = (
        "status",
        "rejected_stage",
        "created_at",
        "access_reviewed_at",
        "submitted_at",
        "final_reviewed_at",
    )

    search_fields = (
        "temple__name",
        "requested_by__username",
        "requested_by__first_name",
        "requested_by__last_name",
        "request_reason",
        "original_name",
        "proposed_name",
        "original_pincode",
        "proposed_pincode",
    )

    list_select_related = (
        "temple",
        "requested_by",
        "original_pincode_location",
        "proposed_pincode_location",
        "access_reviewed_by",
        "final_reviewed_by",
    )

    readonly_fields = (
        "temple",
        "requested_by",
        "request_reason",
        "status",
        "original_name",
        "original_pincode",
        "original_city",
        "original_district",
        "original_state",
        "original_pincode_location",
        "original_latitude",
        "original_longitude",
        "proposed_name",
        "proposed_pincode",
        "proposed_city",
        "proposed_district",
        "proposed_state",
        "proposed_pincode_location",
        "proposed_latitude",
        "proposed_longitude",
        "changed_fields_summary",
        "access_reviewed_by",
        "access_reviewed_at",
        "submitted_at",
        "final_reviewed_by",
        "final_reviewed_at",
        "rejected_stage",
        "rejection_reason",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "Request",
            {
                "fields": (
                    "temple",
                    "requested_by",
                    "request_reason",
                    "status",
                    "created_at",
                    "updated_at",
                )
            },
        ),
        (
            "Original verified details",
            {
                "fields": (
                    "original_name",
                    "original_pincode",
                    "original_pincode_location",
                    (
                        "original_state",
                        "original_district",
                        "original_city",
                    ),
                    (
                        "original_latitude",
                        "original_longitude",
                    ),
                )
            },
        ),
        (
            "Proposed verified details",
            {
                "fields": (
                    "proposed_name",
                    "proposed_pincode",
                    "proposed_pincode_location",
                    (
                        "proposed_state",
                        "proposed_district",
                        "proposed_city",
                    ),
                    (
                        "proposed_latitude",
                        "proposed_longitude",
                    ),
                    "changed_fields_summary",
                    "submitted_at",
                )
            },
        ),
        (
            "Super admin review",
            {
                "fields": (
                    (
                        "access_reviewed_by",
                        "access_reviewed_at",
                    ),
                    (
                        "final_reviewed_by",
                        "final_reviewed_at",
                    ),
                    "rejected_stage",
                    "rejection_reason",
                )
            },
        ),
    )

    actions = (
        "approve_edit_access",
        "reject_edit_access",
        "approve_submitted_changes",
        "reject_submitted_changes",
    )

    ordering = ("-created_at",)
    list_per_page = 50

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(
        description="Changes",
    )
    def requested_changes(self, obj):
        if obj.status in {
            "access_pending",
            "edit_allowed",
        }:
            return "Not submitted yet"

        changed_fields = obj.get_changed_fields()

        if not changed_fields:
            return "No changed fields"

        return ", ".join(
            field_name.replace("_", " ").title()
            for field_name in changed_fields
        )

    @admin.display(
        description="Old → New comparison",
    )
    def changed_fields_summary(self, obj):
        if obj.status in {
            "access_pending",
            "edit_allowed",
        }:
            return "Temple admin changes inka submit cheyyaledhu."

        changed_fields = obj.get_changed_fields()

        if not changed_fields:
            return "Changed fields dorakaledhu."

        comparison_lines = []

        for field_name, values in changed_fields.items():
            old_value = values.get("old")
            new_value = values.get("new")

            old_text = (
                str(old_value)
                if old_value not in {
                    None,
                    "",
                }
                else "—"
            )

            new_text = (
                str(new_value)
                if new_value not in {
                    None,
                    "",
                }
                else "—"
            )

            comparison_lines.append(
                (
                    f"{field_name.replace('_', ' ').title()}: "
                    f"{old_text} → {new_text}"
                )
            )

        return "\n".join(comparison_lines)

    @admin.action(
        description="Approve selected edit-access requests"
    )
    def approve_edit_access(self, request, queryset):
        approved_count = 0
        skipped_count = 0

        request_ids = list(
            queryset.values_list(
                "pk",
                flat=True,
            )
        )

        for edit_request_id in request_ids:
            with transaction.atomic():
                edit_request = (
                    TempleVerifiedEditRequest.objects
                    .select_for_update()
                    .get(pk=edit_request_id)
                )

                if edit_request.status != "access_pending":
                    skipped_count += 1
                    continue

                edit_request.status = "edit_allowed"
                edit_request.access_reviewed_by = request.user
                edit_request.access_reviewed_at = timezone.now()
                edit_request.rejected_stage = ""
                edit_request.rejection_reason = ""

                edit_request.save(
                    update_fields=[
                        "status",
                        "access_reviewed_by",
                        "access_reviewed_at",
                        "rejected_stage",
                        "rejection_reason",
                        "updated_at",
                    ]
                )

                approved_count += 1

        if approved_count:
            self.message_user(
                request,
                (
                    f"{approved_count} edit-access request(s) "
                    "approved successfully."
                ),
                messages.SUCCESS,
            )

        if skipped_count:
            self.message_user(
                request,
                (
                    f"{skipped_count} request(s) skipped. "
                    "Access-pending requests matrame approve cheyyandi."
                ),
                messages.WARNING,
            )

    @admin.action(
        description="Reject selected edit-access request"
    )
    def reject_edit_access(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request,
                (
                    "Edit-access reject cheyyadaniki exactly one "
                    "request select cheyyandi."
                ),
                messages.ERROR,
            )
            return

        rejection_reason = str(
            request.POST.get(
                "rejection_reason",
                "",
            )
        ).strip()

        if not rejection_reason:
            self.message_user(
                request,
                "Reject cheyyadaniki reason compulsory.",
                messages.ERROR,
            )
            return

        edit_request_id = queryset.values_list(
            "pk",
            flat=True,
        ).first()

        with transaction.atomic():
            edit_request = (
                TempleVerifiedEditRequest.objects
                .select_for_update()
                .get(pk=edit_request_id)
            )

            if edit_request.status != "access_pending":
                self.message_user(
                    request,
                    (
                        "Access-pending edit request "
                        "select cheyyandi."
                    ),
                    messages.ERROR,
                )
                return

            edit_request.status = "rejected"
            edit_request.rejected_stage = "access_request"
            edit_request.rejection_reason = rejection_reason
            edit_request.access_reviewed_by = request.user
            edit_request.access_reviewed_at = timezone.now()

            edit_request.save(
                update_fields=[
                    "status",
                    "rejected_stage",
                    "rejection_reason",
                    "access_reviewed_by",
                    "access_reviewed_at",
                    "updated_at",
                ]
            )

        self.message_user(
            request,
            (
                f"{edit_request.temple.name} edit-access "
                "request rejected."
            ),
            messages.WARNING,
        )

    @admin.action(
        description="Approve selected submitted temple changes"
    )
    def approve_submitted_changes(self, request, queryset):
        approved_count = 0
        skipped_count = 0

        request_ids = list(
            queryset.values_list(
                "pk",
                flat=True,
            )
        )

        for edit_request_id in request_ids:
            with transaction.atomic():
                edit_request = (
                    TempleVerifiedEditRequest.objects
                    .select_for_update()
                    .select_related(
                        "temple",
                        "proposed_pincode_location",
                    )
                    .get(pk=edit_request_id)
                )

                if edit_request.status != "changes_pending":
                    skipped_count += 1
                    continue

                temple = (
                    Temple.objects
                    .select_for_update()
                    .get(pk=edit_request.temple_id)
                )

                if (
                    not edit_request.proposed_name.strip()
                    or not edit_request.proposed_pincode.strip()
                    or not edit_request.proposed_city.strip()
                    or not edit_request.proposed_state.strip()
                ):
                    skipped_count += 1

                    self.message_user(
                        request,
                        (
                            f"{temple.name}: proposed verified "
                            "details incomplete."
                        ),
                        messages.WARNING,
                    )
                    continue

                temple.name = edit_request.proposed_name.strip()
                temple.pincode = (
                    edit_request.proposed_pincode.strip()
                )
                temple.city = edit_request.proposed_city.strip()
                temple.district = (
                    edit_request.proposed_district.strip()
                )
                temple.state = edit_request.proposed_state.strip()
                temple.pincode_location = (
                    edit_request.proposed_pincode_location
                )
                temple.latitude = edit_request.proposed_latitude
                temple.longitude = edit_request.proposed_longitude

                temple.save(
                    update_fields=[
                        "name",
                        "pincode",
                        "city",
                        "district",
                        "state",
                        "pincode_location",
                        "latitude",
                        "longitude",
                        "updated_at",
                    ]
                )

                edit_request.status = "approved"
                edit_request.final_reviewed_by = request.user
                edit_request.final_reviewed_at = timezone.now()
                edit_request.rejected_stage = ""
                edit_request.rejection_reason = ""

                edit_request.save(
                    update_fields=[
                        "status",
                        "final_reviewed_by",
                        "final_reviewed_at",
                        "rejected_stage",
                        "rejection_reason",
                        "updated_at",
                    ]
                )

                approved_count += 1

        if approved_count:
            self.message_user(
                request,
                (
                    f"{approved_count} submitted change request(s) "
                    "approved. Temple details updated."
                ),
                messages.SUCCESS,
            )

        if skipped_count:
            self.message_user(
                request,
                (
                    f"{skipped_count} request(s) skipped. "
                    "Changes-pending requests matrame approve cheyyandi."
                ),
                messages.WARNING,
            )

    @admin.action(
        description="Reject selected submitted temple changes"
    )
    def reject_submitted_changes(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request,
                (
                    "Submitted changes reject cheyyadaniki exactly "
                    "one request select cheyyandi."
                ),
                messages.ERROR,
            )
            return

        rejection_reason = str(
            request.POST.get(
                "rejection_reason",
                "",
            )
        ).strip()

        if not rejection_reason:
            self.message_user(
                request,
                "Reject cheyyadaniki reason compulsory.",
                messages.ERROR,
            )
            return

        edit_request_id = queryset.values_list(
            "pk",
            flat=True,
        ).first()

        with transaction.atomic():
            edit_request = (
                TempleVerifiedEditRequest.objects
                .select_for_update()
                .select_related("temple")
                .get(pk=edit_request_id)
            )

            if edit_request.status != "changes_pending":
                self.message_user(
                    request,
                    (
                        "Changes-pending edit request "
                        "select cheyyandi."
                    ),
                    messages.ERROR,
                )
                return

            edit_request.status = "rejected"
            edit_request.rejected_stage = "submitted_changes"
            edit_request.rejection_reason = rejection_reason
            edit_request.final_reviewed_by = request.user
            edit_request.final_reviewed_at = timezone.now()

            edit_request.save(
                update_fields=[
                    "status",
                    "rejected_stage",
                    "rejection_reason",
                    "final_reviewed_by",
                    "final_reviewed_at",
                    "updated_at",
                ]
            )

        self.message_user(
            request,
            (
                f"{edit_request.temple.name} submitted "
                "changes rejected."
            ),
            messages.WARNING,
        )