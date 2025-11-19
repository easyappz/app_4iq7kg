import secrets

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Member, MemberToken, Subscription
from .serializers import (
    AuthTokenSerializer,
    MemberListSerializer,
    MemberLoginSerializer,
    MemberProfileSerializer,
    MemberRegisterSerializer,
    MemberUpdateSerializer,
    MessageSerializer,
)


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
