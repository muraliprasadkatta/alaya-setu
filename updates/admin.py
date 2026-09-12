
# Register your models here.
from django.contrib import admin

from .models import TempleUpdate


@admin.register(TempleUpdate)
class TempleUpdateAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "temple",
        "update_type",
        "status",
        "created_by",
        "created_at",
    )
    list_filter = ("update_type", "status", "created_at")
    search_fields = (
        "title",
        "description",
        "temple__name",
        "created_by__username",
    )
    autocomplete_fields = ("temple", "created_by")