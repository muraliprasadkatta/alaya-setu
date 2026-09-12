from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = (
        "username",
        "email",
        "role",
        "phone_number",
        "is_staff",
        "is_superuser",
        "is_active",
    )

    list_filter = (
        "role",
        "is_staff",
        "is_superuser",
        "is_active",
    )

    search_fields = (
        "username",
        "email",
        "first_name",
        "last_name",
        "phone_number",
    )

    fieldsets = UserAdmin.fieldsets + (
        (
            "Aalaya Setu Details",
            {
                "fields": (
                    "role",
                    "phone_number",
                )
            },
        ),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "Aalaya Setu Details",
            {
                "fields": (
                    "role",
                    "phone_number",
                )
            },
        ),
    )