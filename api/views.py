import secrets

from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Comment,
    CommentLike,
    Member,
    MemberToken,
    Post,
    PostLike,
    Subscription,
)
from .serializers import (
    AuthTokenSerializer,
    CommentCreateUpdateSerializer,
    CommentSerializer,
    MemberListSerializer,
    MemberLoginSerializer,
    MemberProfileSerializer,
    MemberRegisterSerializer,
    MemberUpdateSerializer,
    MessageSerializer,
    PostCreateUpdateSerializer,
    PostSerializer,
)


class StandardResultsSetPagination(PageNumberPagination):
    """Default pagination style used for list endpoints."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class IsAuthorOrReadOnly(permissions.BasePermission):
    """Allow read access to anyone, write access only to the author."""

    def has_object_permission(self, request, view, obj) -> bool:  # pragma: no cover - simple permission logic
        if request.method in permissions.SAFE_METHODS:
            return True

        author = getattr(obj, "author", None)
        if not isinstance(request.user, Member) or author is None:
            return False

        return author.id == request.user.id


class HelloView(APIView):
    """A simple API endpoint that returns a greeting message."""

    @extend_schema(
        responses={200: MessageSerializer},
        description="Get a hello world message",
        tags=["api"],
    )
    def get(self, request):
        data = {"message": "Hello!", "timestamp": timezone.now()}
        serializer = MessageSerializer(data)
        return Response(serializer.data)


class RegisterView(APIView):
    """Register a new member and return an authentication token."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=MemberRegisterSerializer,
        responses={201: AuthTokenSerializer},
        description="Register a new member and obtain an authentication token.",
        tags=["auth"],
    )
    def post(self, request):
        serializer = MemberRegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        member = serializer.save()
        token_key = secrets.token_hex(20)
        token = MemberToken.objects.create(key=token_key, member=member)

        response_data = AuthTokenSerializer({"token": token.key, "member": member})
        return Response(response_data.data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """Authenticate an existing member and return an authentication token."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=MemberLoginSerializer,
        responses={200: AuthTokenSerializer},
        description="Log in an existing member and obtain an authentication token.",
        tags=["auth"],
    )
    def post(self, request):
        serializer = MemberLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        member: Member = serializer.validated_data["member"]

        # Reuse an existing token if present, otherwise create a new one.
        token = MemberToken.objects.filter(member=member).first()
        if token is None:
            token_key = secrets.token_hex(20)
            token = MemberToken.objects.create(key=token_key, member=member)

        response_data = AuthTokenSerializer({"token": token.key, "member": member})
        return Response(response_data.data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Log out the current member by deleting the current token."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={200: {"type": "object", "properties": {"detail": {"type": "string"}}}},
        description="Log out the current authenticated member by revoking the current token.",
        tags=["auth"],
    )
    def post(self, request):
        auth = getattr(request, "auth", None)

        if isinstance(auth, MemberToken):
            auth.delete()
        elif isinstance(request.user, Member):
            # Fallback: delete all tokens for this member.
            MemberToken.objects.filter(member=request.user).delete()

        return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)


class CurrentMemberView(APIView):
    """Return the profile of the currently authenticated member."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={200: MemberProfileSerializer},
        description="Get the current authenticated member profile.",
        tags=["auth"],
    )
    def get(self, request):
        member = request.user
        serializer = MemberProfileSerializer(member)
        return Response(serializer.data)


class MemberDetailView(APIView):
    """Public view to retrieve a member profile by id."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses={200: MemberProfileSerializer},
        description="Retrieve a member profile by id.",
        tags=["members"],
    )
    def get(self, request, id):  # noqa: A003 - id is required by URL pattern
        member = get_object_or_404(Member, id=id)
        serializer = MemberProfileSerializer(member)
        return Response(serializer.data)


class MemberSelfUpdateView(APIView):
    """Allow the authenticated member to update their own profile."""

    permission_classes = [permissions.IsAuthenticated]

    def _update(self, request, partial: bool):
        member = request.user
        if not isinstance(member, Member):
            return Response(
                {"detail": "Authenticated user is not a member."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MemberUpdateSerializer(member, data=request.data, partial=partial)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updated_member = serializer.save()
        output_serializer = MemberProfileSerializer(updated_member)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        request=MemberUpdateSerializer,
        responses={200: MemberProfileSerializer},
        description="Update the current authenticated member profile.",
        tags=["members"],
    )
    def put(self, request):
        return self._update(request, partial=False)

    @extend_schema(
        request=MemberUpdateSerializer,
        responses={200: MemberProfileSerializer},
        description="Partially update the current authenticated member profile.",
        tags=["members"],
    )
    def patch(self, request):
        return self._update(request, partial=True)


class MemberSearchView(APIView):
    """Search members by username, first name, or last name."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        parameters=[
            {
                "name": "q",
                "in": "query",
                "required": False,
                "schema": {"type": "string"},
                "description": "Search query for username, first name, or last name.",
            }
        ],
        responses={200: MemberListSerializer(many=True)},
        description="Search members by username, first name, or last name.",
        tags=["members"],
    )
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            members = Member.objects.none()
        else:
            members = Member.objects.filter(
                Q(username__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            ).distinct()

        serializer = MemberListSerializer(members, many=True)
        return Response(serializer.data)


class FollowView(APIView):
    """Allow the authenticated member to follow another member."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: {
                "type": "object",
                "properties": {
                    "following": {"type": "boolean"},
                    "detail": {"type": "string"},
                },
                "required": ["following", "detail"],
            }
        },
        description="Follow a member by id.",
        tags=["subscriptions"],
    )
    def post(self, request, id):  # noqa: A003 - id is required by URL pattern
        follower = request.user
        if not isinstance(follower, Member):
            return Response(
                {"detail": "Authenticated user is not a member."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target = get_object_or_404(Member, id=id)

        if target.id == follower.id:
            return Response(
                {"detail": "You cannot follow yourself.", "following": False},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subscription, created = Subscription.objects.get_or_create(
            follower=follower,
            following=target,
        )

        if created:
            detail = "Now following the member."
        else:
            detail = "You are already following this member."

        return Response(
            {"following": True, "detail": detail},
            status=status.HTTP_200_OK,
        )


class UnfollowView(APIView):
    """Allow the authenticated member to unfollow another member."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: {
                "type": "object",
                "properties": {
                    "following": {"type": "boolean"},
                    "detail": {"type": "string"},
                },
                "required": ["following", "detail"],
            }
        },
        description="Unfollow a member by id.",
        tags=["subscriptions"],
    )
    def post(self, request, id):  # noqa: A003 - id is required by URL pattern
        follower = request.user
        if not isinstance(follower, Member):
            return Response(
                {"detail": "Authenticated user is not a member."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target = get_object_or_404(Member, id=id)

        deleted_count, _ = Subscription.objects.filter(
            follower=follower,
            following=target,
        ).delete()

        if deleted_count:
            detail = "Unfollowed the member."
        else:
            detail = "You were not following this member."

        return Response(
            {"following": False, "detail": detail},
            status=status.HTTP_200_OK,
        )


class MemberSubscriptionsView(APIView):
    """List members that the given member is following."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses={200: MemberListSerializer(many=True)},
        description="List members that the given member is following.",
        tags=["subscriptions"],
    )
    def get(self, request, id):  # noqa: A003 - id is required by URL pattern
        member = get_object_or_404(Member, id=id)
        following_members = Member.objects.filter(
            followers__follower=member,
        ).distinct()

        serializer = MemberListSerializer(following_members, many=True)
        return Response(serializer.data)


class MemberFollowersView(APIView):
    """List members who follow the given member."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses={200: MemberListSerializer(many=True)},
        description="List members who follow the given member.",
        tags=["subscriptions"],
    )
    def get(self, request, id):  # noqa: A003 - id is required by URL pattern
        member = get_object_or_404(Member, id=id)
        follower_members = Member.objects.filter(
            following__following=member,
        ).distinct()

        serializer = MemberListSerializer(follower_members, many=True)
        return Response(serializer.data)


class PostListCreateView(generics.ListCreateAPIView):
    """Global feed of posts and endpoint for creating new posts."""

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = StandardResultsSetPagination
    serializer_class = PostSerializer

    def get_queryset(self):
        return (
            Post.objects.all()
            .select_related("author")
            .annotate(
                likes_count=Count("likes"),
                comments_count=Count("comments"),
            )
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.request.method in ("POST", "PUT", "PATCH"):
            return PostCreateUpdateSerializer
        return PostSerializer

    @extend_schema(
        request=PostCreateUpdateSerializer,
        responses={
            200: PostSerializer(many=True),
        },
        description="List posts from all members (global feed) with pagination.",
        tags=["posts"],
    )
    def get(self, request, *args, **kwargs):  # type: ignore[override]
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=PostCreateUpdateSerializer,
        responses={201: PostSerializer},
        description="Create a new post for the authenticated member.",
        tags=["posts"],
    )
    def post(self, request, *args, **kwargs):  # type: ignore[override]
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        author = self.request.user
        if not isinstance(author, Member):
            raise PermissionDenied("Authenticated user is not a member.")
        serializer.save(author=author)


class PostDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a single post."""

    lookup_field = "id"
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def get_queryset(self):
        return (
            Post.objects.all()
            .select_related("author")
            .annotate(
                likes_count=Count("likes"),
                comments_count=Count("comments"),
            )
        )

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return PostCreateUpdateSerializer
        return PostSerializer

    @extend_schema(
        responses={200: PostSerializer},
        description="Retrieve a single post by id.",
        tags=["posts"],
    )
    def get(self, request, *args, **kwargs):  # type: ignore[override]
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=PostCreateUpdateSerializer,
        responses={200: PostSerializer},
        description="Update a post (only the author is allowed).",
        tags=["posts"],
    )
    def put(self, request, *args, **kwargs):  # type: ignore[override]
        return super().put(request, *args, **kwargs)

    @extend_schema(
        request=PostCreateUpdateSerializer,
        responses={200: PostSerializer},
        description="Partially update a post (only the author is allowed).",
        tags=["posts"],
    )
    def patch(self, request, *args, **kwargs):  # type: ignore[override]
        return super().patch(request, *args, **kwargs)

    @extend_schema(
        responses={204: None},
        description="Delete a post (only the author is allowed).",
        tags=["posts"],
    )
    def delete(self, request, *args, **kwargs):  # type: ignore[override]
        return super().delete(request, *args, **kwargs)


class UserPostsView(generics.ListAPIView):
    """List posts authored by a specific member."""

    permission_classes = [permissions.AllowAny]
    pagination_class = StandardResultsSetPagination
    serializer_class = PostSerializer

    def get_queryset(self):
        member_id = self.kwargs.get("id")
        return (
            Post.objects.filter(author_id=member_id)
            .select_related("author")
            .annotate(
                likes_count=Count("likes"),
                comments_count=Count("comments"),
            )
            .order_by("-created_at")
        )

    @extend_schema(
        responses={200: PostSerializer(many=True)},
        description="List posts authored by the given member (with pagination).",
        tags=["posts"],
    )
    def get(self, request, *args, **kwargs):  # type: ignore[override]
        return super().get(request, *args, **kwargs)


class PostLikeToggleView(APIView):
    """Toggle like on a post for the authenticated member."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: {
                "type": "object",
                "properties": {
                    "liked": {"type": "boolean"},
                    "likes_count": {"type": "integer"},
                },
                "required": ["liked", "likes_count"],
            }
        },
        description="Toggle like on a post. Returns current like state and likes count.",
        tags=["posts"],
    )
    def post(self, request, id):  # noqa: A003 - id is required by URL pattern
        member = request.user
        if not isinstance(member, Member):
            return Response(
                {"detail": "Authenticated user is not a member."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        post = get_object_or_404(Post, id=id)

        like, created = PostLike.objects.get_or_create(member=member, post=post)
        if created:
            liked = True
        else:
            like.delete()
            liked = False

        likes_count = PostLike.objects.filter(post=post).count()
        return Response(
            {"liked": liked, "likes_count": likes_count},
            status=status.HTTP_200_OK,
        )


class PostCommentsListCreateView(generics.ListCreateAPIView):
    """List or create comments for a specific post."""

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = StandardResultsSetPagination
    lookup_url_kwarg = "post_id"

    def get_queryset(self):
        post_id = self.kwargs.get("post_id")
        return (
            Comment.objects.filter(post_id=post_id)
            .select_related("author", "post", "parent")
            .annotate(likes_count=Count("likes"))
            .order_by("created_at")
        )

    def get_serializer_class(self):
        if self.request.method in ("POST", "PUT", "PATCH"):
            return CommentCreateUpdateSerializer
        return CommentSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.method in ("POST", "PUT", "PATCH"):
            post_id = self.kwargs.get("post_id")
            if post_id is not None:
                post = get_object_or_404(Post, id=post_id)
                context["post"] = post
        return context

    @extend_schema(
        responses={200: CommentSerializer(many=True)},
        description="List comments for the specified post.",
        tags=["comments"],
    )
    def get(self, request, *args, **kwargs):  # type: ignore[override]
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=CommentCreateUpdateSerializer,
        responses={201: CommentSerializer},
        description="Create a new comment on the specified post.",
        tags=["comments"],
    )
    def post(self, request, *args, **kwargs):  # type: ignore[override]
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        author = self.request.user
        if not isinstance(author, Member):
            raise PermissionDenied("Authenticated user is not a member.")

        post_id = self.kwargs.get("post_id")
        post = get_object_or_404(Post, id=post_id)
        serializer.save(post=post, author=author)


class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a single comment."""

    lookup_field = "id"
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def get_queryset(self):
        return (
            Comment.objects.all()
            .select_related("author", "post", "parent")
            .annotate(likes_count=Count("likes"))
        )

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return CommentCreateUpdateSerializer
        return CommentSerializer

    @extend_schema(
        responses={200: CommentSerializer},
        description="Retrieve a single comment by id.",
        tags=["comments"],
    )
    def get(self, request, *args, **kwargs):  # type: ignore[override]
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=CommentCreateUpdateSerializer,
        responses={200: CommentSerializer},
        description="Update a comment (only the author is allowed).",
        tags=["comments"],
    )
    def put(self, request, *args, **kwargs):  # type: ignore[override]
        return super().put(request, *args, **kwargs)

    @extend_schema(
        request=CommentCreateUpdateSerializer,
        responses={200: CommentSerializer},
        description="Partially update a comment (only the author is allowed).",
        tags=["comments"],
    )
    def patch(self, request, *args, **kwargs):  # type: ignore[override]
        return super().patch(request, *args, **kwargs)

    @extend_schema(
        responses={204: None},
        description="Delete a comment (only the author is allowed).",
        tags=["comments"],
    )
    def delete(self, request, *args, **kwargs):  # type: ignore[override]
        return super().delete(request, *args, **kwargs)


class CommentLikeToggleView(APIView):
    """Toggle like on a comment for the authenticated member."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: {
                "type": "object",
                "properties": {
                    "liked": {"type": "boolean"},
                    "likes_count": {"type": "integer"},
                },
                "required": ["liked", "likes_count"],
            }
        },
        description="Toggle like on a comment. Returns current like state and likes count.",
        tags=["comments"],
    )
    def post(self, request, id):  # noqa: A003 - id is required by URL pattern
        member = request.user
        if not isinstance(member, Member):
            return Response(
                {"detail": "Authenticated user is not a member."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment = get_object_or_404(Comment, id=id)

        like, created = CommentLike.objects.get_or_create(member=member, comment=comment)
        if created:
            liked = True
        else:
            like.delete()
            liked = False

        likes_count = CommentLike.objects.filter(comment=comment).count()
        return Response(
            {"liked": liked, "likes_count": likes_count},
            status=status.HTTP_200_OK,
        )
