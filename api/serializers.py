from django.contrib.auth.hashers import check_password, make_password
from rest_framework import serializers

from .models import Member


class MessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=200)
    timestamp = serializers.DateTimeField(read_only=True)


class MemberRegisterSerializer(serializers.ModelSerializer):
    """Serializer for member registration.

    Handles validation and password hashing.
    """

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = Member
        fields = [
            "username",
            "first_name",
            "last_name",
            "password",
            "bio",
            "birth_date",
            "avatar",
        ]

    def validate_username(self, value: str) -> str:
        if Member.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "A member with this username already exists."
            )
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        member = Member(**validated_data)
        member.password = make_password(password)
        member.save()
        return member


class MemberLoginSerializer(serializers.Serializer):
    """Serializer for member login.

    Validates username/password and returns the authenticated member
    in ``validated_data['member']``.
    """

    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        if not username or not password:
            raise serializers.ValidationError(
                "Both username and password are required."
            )

        try:
            member = Member.objects.get(username=username)
        except Member.DoesNotExist:
            raise serializers.ValidationError(
                "Invalid username or password."
            )

        if not check_password(password, member.password):
            raise serializers.ValidationError(
                "Invalid username or password."
            )

        attrs["member"] = member
        return attrs


class MemberProfileSerializer(serializers.ModelSerializer):
    """Safe representation of a member profile (no password)."""

    class Meta:
        model = Member
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "bio",
            "birth_date",
            "avatar",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class AuthTokenSerializer(serializers.Serializer):
    """Combined representation of auth token and member profile."""

    token = serializers.CharField()
    member = MemberProfileSerializer()
