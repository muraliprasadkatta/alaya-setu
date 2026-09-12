from django.urls import path
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)

from .views import (
    SendOTPView,
    TempleAdminLoginView,
    TempleAdminRegisterView,
    UserProfileView,
    VerifyOTPView,
    SetDevoteeNameView,
)


urlpatterns = [
    path(
        "temple-admin/register/",
        TempleAdminRegisterView.as_view(),
        name="temple-admin-register",
    ),
    path(
        "login/",
        TempleAdminLoginView.as_view(),
        name="login",
    ),
    path(
        "token/refresh/",
        TokenRefreshView.as_view(),
        name="token-refresh",
    ),
    path(
        "profile/",
        UserProfileView.as_view(),
        name="profile",
    ),

        path(
        "devotee/send-otp/",
        SendOTPView.as_view(),
        name="devotee-send-otp",
    ),
    path(
        "devotee/verify-otp/",
        VerifyOTPView.as_view(),
        name="devotee-verify-otp",
    ),

    path(
        "devotee/set-name/",
        SetDevoteeNameView.as_view(),
        name="devotee-set-name",
    ),
]