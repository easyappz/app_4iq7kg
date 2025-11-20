from django.contrib.auth.hashers import check_password, make_password
from rest_framework import serializers

from .models import Comment, Dialog, Member, Message, Post, PostMedia


class HelloMessageSerializer(serializers.Serializer):
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
        except Member.DoesNotExist as exc:  # pragma: no cover - simple error path
            raise serializers.ValidationError(
                "Invalid username or password."
            ) from exc

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


class MemberUpdateSerializer(serializers.ModelSerializer):
    """Serializer used for updating the current member profile.

    Allows changing basic profile fields but not username or password.
    """

    class Meta:
        model = Member
        fields = [
            "first_name",
            "last_name",
            "bio",
            "birth_date",
            "avatar",
        ]


class MemberListSerializer(serializers.ModelSerializer):
    """Compact serializer for listing/searching members."""

    class Meta:
        model = Member
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "avatar",
        ]


class AuthTokenSerializer(serializers.Serializer):
    """Combined representation of auth token and member profile."""

    token = serializers.CharField()
    member = MemberProfileSerializer()


class PostMediaSerializer(serializers.ModelSerializer):
    """Read-only serializer for media attachments of a post."""

    class Meta:
        model = PostMedia
        fields = [
            "id",
            "file",
            "media_type",
            "created_at",
        ]
        read_only_fields = fields


class PostSerializer(serializers.ModelSerializer):
    """Read-only serializer for posts with aggregated counters."""

    author = MemberListSerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    media = PostMediaSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "author",
            "text",
            "image",
            "media",
            "created_at",
            "updated_at",
            "likes_count",
            "comments_count",
        ]
        read_only_fields = [
            "id",
            "author",
            "media",
            "created_at",
            "updated_at",
            "likes_count",
            "comments_count",
        ]

    def get_likes_count(self, obj) -> int:
        annotated = getattr(obj, "likes_count", None)
        if annotated is not None:
            return int(annotated)
        return obj.likes.count()

    def get_comments_count(self, obj) -> int:
        annotated = getattr(obj, "comments_count", None)
        if annotated is not None:
            return int(annotated)
        return obj.comments.count()


class PostCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating posts."""

    class Meta:
        model = Post
        fields = ["text", "image"]


class CommentReplySerializer(serializers.ModelSerializer):
    """Serializer for replies used inside CommentSerializer.

    Does not include nested replies to avoid deep recursion.
    """

    author = MemberListSerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id",
            "post",
            "author",
            "text",
            "parent",
            "created_at",
            "updated_at",
            "likes_count",
        ]
        read_only_fields = fields

    def get_likes_count(self, obj) -> int:
        annotated = getattr(obj, "likes_count", None)
        if annotated is not None:
            return int(annotated)
        return obj.likes.count()


class CommentSerializer(serializers.ModelSerializer):
    """Read-only serializer for comments with likes and optional replies."""

    author = MemberListSerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id",
            "post",
            "author",
            "text",
            "parent",
            "created_at",
            "updated_at",
            "likes_count",
            "replies",
        ]
        read_only_fields = fields

    def get_likes_count(self, obj) -> int:
        annotated = getattr(obj, "likes_count", None)
        if annotated is not None:
            return int(annotated)
        return obj.likes.count()

    def get_replies(self, obj):
        replies_qs = obj.replies.all().select_related("author")
        serializer = CommentReplySerializer(replies_qs, many=True, context=self.context)
        return serializer.data


class CommentCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating comments.

    The ``post`` is supplied by the view; only ``text`` and ``parent`` are writable.
    """

    class Meta:
        model = Comment
        fields = ["text", "parent"]

    def validate_parent(self, value: Comment | None) -> Comment | None:  # type: ignore[name-defined]
        if value is None:
            return value

        expected_post = None
        post_from_context = self.context.get("post")
        if post_from_context is not None:
            expected_post = post_from_context
        elif self.instance is not None:
            expected_post = self.instance.post

        if expected_post is not None and value.post_id != expected_post.id:
            raise serializers.ValidationError(
                "Parent comment must belong to the same post."
            )

        return value


class DialogSerializer(serializers.ModelSerializer):
    """Serializer for direct dialogs between two members.

    Includes minimal member representations, the other participant relative to
    the current user, last message, and unread count.
    """

    member1 = MemberListSerializer(read_only=True)
    member2 = MemberListSerializer(read_only=True)
    other_member = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Dialog
        fields = [
            "id",
            "member1",
            "member2",
            "created_at",
            "other_member",
            "last_message",
            "unread_count",
        ]
    
        read_only_fields = fields

    def get_other_member(self, obj):
        request = self.context.get("request")
        current_member = getattr(request, "user", None)

        if not isinstance(current_member, Member):
            return None

        if obj.member1_id == current_member.id:
            other = obj.member2
        elif obj.member2_id == current_member.id:
            other = obj.member1
        else:
            return None

        return MemberListSerializer(other, context=self.context).data

    def get_last_message(self, obj):
        last_msg = (
            obj.messages.select_related("sender")
            .order_by("-created_at")
            .first()
        )
        if last_msg is None:
            return None
        return MessageSerializer(last_msg, context=self.context).data

    def get_unread_count(self, obj) -> int:
        request = self.context.get("request")
        current_member = getattr(request, "user", None)

        if not isinstance(current_member, Member):
            return 0

        return (
            obj.messages.filter(is_read=False)
            .exclude(sender=current_member)
            .count()
        )


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for messages inside dialogs."""

    sender = MemberListSerializer(read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "dialog",
            "sender",
            "text",
            "image",
            "created_at",
            "is_read",
        ]
        read_only_fields = [
            "id",
            "dialog",
            "sender",
            "created_at",
            "is_read",
        ]


class MessageCreateSerializer(serializers.ModelSerializer):
    """Serializer used for creating new messages in a dialog.

    At least one of ``text`` or ``image`` must be provided.
    """

    class Meta:
        model = Message
        fields = ["text", "image"]

    def validate(self, attrs):
        text = (attrs.get("text") or "").strip()
        image = (attrs.get("image") or "").strip()
        if not text and not image:
            raise serializers.ValidationError(
                "At least one of text or image must be provided."
            )
        return attrs
