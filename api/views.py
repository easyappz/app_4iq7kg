import secrets

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Member, MemberToken
from .serializers import (
    AuthTokenSerializer,
    MemberLoginSerializer,
    MemberProfileSerializer,
    MemberRegisterSerializer,
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
