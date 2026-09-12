from django.urls import path

from .views import (
    MyTempleListView,
    MyTempleRequestListView,
    PincodeLookupView,
    TempleManagementDetailView,
    TempleMemberDetailView,
    TempleMemberListCreateView,
    TempleRequestCreateView,
    TempleRequestResubmitView,
    TempleVerifiedEditRequestView,
    TempleVerifiedEditSubmitView,
    VerifiedTempleListView,
    PublicTempleDetailView,
    PublicTempleListView,
    PublicCityListView,
)


app_name = "temples"


urlpatterns = [
    path(
        "pincode/<str:pincode>/",
        PincodeLookupView.as_view(),
        name="pincode-lookup",
    ),
    path(
        "verified/",
        VerifiedTempleListView.as_view(),
        name="verified-temple-list",
    ),
    path(
        "my/",
        MyTempleListView.as_view(),
        name="my-temple-list",
    ),
    path(
        "<int:temple_id>/manage/",
        TempleManagementDetailView.as_view(),
        name="temple-management-detail",
    ),

    # Verified temple details edit-access request.
    path(
        "<int:temple_id>/verified-edit-request/",
        TempleVerifiedEditRequestView.as_view(),
        name="temple-verified-edit-request",
    ),

    # Submit changed verified details after edit access approval.
    path(
        "<int:temple_id>/verified-edit-request/submit/",
        TempleVerifiedEditSubmitView.as_view(),
        name="temple-verified-edit-submit",
    ),

    path(
        "<int:temple_id>/members/",
        TempleMemberListCreateView.as_view(),
        name="temple-member-list-create",
    ),
    path(
        "<int:temple_id>/members/<int:member_id>/",
        TempleMemberDetailView.as_view(),
        name="temple-member-detail",
    ),
    path(
        "requests/my/",
        MyTempleRequestListView.as_view(),
        name="my-temple-request-list",
    ),
    path(
        "requests/<int:request_id>/resubmit/",
        TempleRequestResubmitView.as_view(),
        name="temple-request-resubmit",
    ),
    path(
        "requests/",
        TempleRequestCreateView.as_view(),
        name="temple-request-create",
    ),

    path(
        "public/",
        PublicTempleListView.as_view(),
        name="public-temple-list",
    ),
    path(
        "public/<int:temple_id>/",
        PublicTempleDetailView.as_view(),
        name="public-temple-detail",
    ),
    path(
        "public/cities/",
        PublicCityListView.as_view(),
        name="public-city-list",
    ),
]