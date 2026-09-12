from django.urls import path

from .views import (
    PublicUpdateListView,
    TempleAnnouncementDetailView,
    TempleAnnouncementListCreateView,
)

app_name = "updates"

urlpatterns = [
    path(
        "announcements/public/",
        PublicUpdateListView.as_view(),
        name="public-announcement-list",
    ),
    path(
        "<int:temple_id>/announcements/",
        TempleAnnouncementListCreateView.as_view(),
        name="temple-announcement-list-create",
    ),
    path(
        "<int:temple_id>/announcements/<int:announcement_id>/",
        TempleAnnouncementDetailView.as_view(),
        name="temple-announcement-detail",
    ),
]