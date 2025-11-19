from django.urls import path

from .views import (
    CurrentMemberView,
    FollowView,
    HelloView,
    LoginView,
    LogoutView,
    MemberDetailView,
    MemberFollowersView,
    MemberSearchView,
    MemberSelfUpdateView,
    MemberSubscriptionsView,
    RegisterView,
)

urlpatterns = [
    path("hello/", HelloView.as_view(), name="hello"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", CurrentMemberView.as_view(), name="auth-me"),
    path("members/<int:id>/", MemberDetailView.as_view(), name="member-detail"),
    path("members/me/", MemberSelfUpdateView.as_view(), name="member-self-update"),
    path("members/search/", MemberSearchView.as_view(), name="member-search"),
    path("members/<int:id>/follow/", FollowView.as_view(), name="member-follow"),
    path("members/<int:id>/unfollow/", UnfollowView.as_view(), name="member-unfollow"),
    path(
        "members/<int:id>/following/",
        MemberSubscriptionsView.as_view(),
        name="member-following",
    ),
    path(
        "members/<int:id>/followers/",
        MemberFollowersView.as_view(),
        name="member-followers",
    ),
]
