from django.urls import path

from .views import (
    CommentDetailView,
    CommentLikeToggleView,
    CurrentMemberView,
    DialogListView,
    DialogMarkAllReadView,
    DialogMessagesListCreateView,
    DialogWithMemberView,
    FollowView,
    HelloView,
    LoginView,
    LogoutView,
    MemberDetailView,
    MemberFollowersView,
    MemberSearchView,
    MemberSelfUpdateView,
    MemberSubscriptionsView,
    MessageMarkReadView,
    PostCommentsListCreateView,
    PostDetailView,
    PostLikeToggleView,
    PostListCreateView,
    RegisterView,
    UnfollowView,
    UserPostsView,
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
    # Posts
    path("posts/", PostListCreateView.as_view(), name="post-list-create"),
    path("posts/<int:id>/", PostDetailView.as_view(), name="post-detail"),
    path("members/<int:id>/posts/", UserPostsView.as_view(), name="member-posts"),
    path("posts/<int:id>/like/", PostLikeToggleView.as_view(), name="post-like-toggle"),
    # Comments
    path(
        "posts/<int:post_id>/comments/",
        PostCommentsListCreateView.as_view(),
        name="post-comments",
    ),
    path("comments/<int:id>/", CommentDetailView.as_view(), name="comment-detail"),
    path(
        "comments/<int:id>/like/",
        CommentLikeToggleView.as_view(),
        name="comment-like-toggle",
    ),
    # Dialogs / Messenger
    path("dialogs/", DialogListView.as_view(), name="dialog-list"),
    path(
        "dialogs/with/<int:member_id>/",
        DialogWithMemberView.as_view(),
        name="dialog-with-member",
    ),
    path(
        "dialogs/<int:dialog_id>/messages/",
        DialogMessagesListCreateView.as_view(),
        name="dialog-messages",
    ),
    path(
        "messages/<int:id>/read/",
        MessageMarkReadView.as_view(),
        name="message-mark-read",
    ),
    path(
        "dialogs/<int:dialog_id>/read/",
        DialogMarkAllReadView.as_view(),
        name="dialog-mark-all-read",
    ),
]
