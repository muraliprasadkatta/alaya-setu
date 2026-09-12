from django.urls import path

from .views import (
    EventLikeToggleView,
    TempleEventDetailView,
    TempleEventListCreateView,
    PublicEventListView,
    EventCommentListCreateView,
)


app_name = "events"


urlpatterns = [
    path(
        "temples/<int:temple_id>/",
        TempleEventListCreateView.as_view(),
        name="event-list-create",
    ),
    path(
        "temples/<int:temple_id>/<int:event_id>/",
        TempleEventDetailView.as_view(),
        name="event-detail",
    ),

    path(
        "<int:event_id>/like/",
        EventLikeToggleView.as_view(),
        name="event-like-toggle",
    ),

    path(
        "public/",
        PublicEventListView.as_view(),
        name="public-event-list",
    ),

    path(
        "<int:event_id>/comments/",
        EventCommentListCreateView.as_view(),
        name="event-comments",
    ),
]