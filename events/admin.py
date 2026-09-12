from django.contrib import admin

from .models import TempleEvent


@admin.register(TempleEvent)
class TempleEventAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "temple",
        "event_type",
        "event_date",
        "start_time",
        "status",
        "created_by",
    )
    list_filter = ("event_type", "status", "event_date")
    search_fields = (
        "title",
        "description",
        "temple__name",
        "created_by__username",
    )
    autocomplete_fields = ("temple", "created_by")

# Register your models here.
