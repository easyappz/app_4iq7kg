from django.contrib import admin

from .models import (
    Comment,
    CommentLike,
    Dialog,
    Member,
    MemberToken,
    Message,
    Post,
    PostLike,
    PostMedia,
    Subscription,
)


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "first_name", "last_name", "created_at")
    search_fields = ("username", "first_name", "last_name")
    list_filter = ("created_at",)
    ordering = ("-created_at",)


@admin.register(MemberToken)
class MemberTokenAdmin(admin.ModelAdmin):
    list_display = ("key", "member", "created_at")
    search_fields = ("key", "member__username")
    list_filter = ("created_at",)


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("id", "author", "short_text", "created_at")
    search_fields = ("author__username", "text")
    list_filter = ("created_at",)
    ordering = ("-created_at",)

    def short_text(self, obj):
        if not obj.text:
            return ""
        value = obj.text[:50]
        if len(obj.text) > 50:
            value += "..."
        return value

    short_text.short_description = "Text preview"


@admin.register(PostMedia)
class PostMediaAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "media_type", "file", "created_at")
    search_fields = ("post__id", "post__author__username")
    list_filter = ("media_type", "created_at")


@admin.register(PostLike)
class PostLikeAdmin(admin.ModelAdmin):
    list_display = ("id", "member", "post", "created_at")
    search_fields = ("member__username",)
    list_filter = ("created_at",)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "author", "short_text", "parent", "created_at")
    search_fields = ("author__username", "text")
    list_filter = ("created_at",)

    def short_text(self, obj):
        if not obj.text:
            return ""
        value = obj.text[:50]
        if len(obj.text) > 50:
            value += "..."
        return value

    short_text.short_description = "Text preview"


@admin.register(CommentLike)
class CommentLikeAdmin(admin.ModelAdmin):
    list_display = ("id", "member", "comment", "created_at")
    search_fields = ("member__username",)
    list_filter = ("created_at",)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("id", "follower", "following", "created_at")
    search_fields = ("follower__username", "following__username")
    list_filter = ("created_at",)


@admin.register(Dialog)
class DialogAdmin(admin.ModelAdmin):
    list_display = ("id", "member1", "member2", "created_at")
    search_fields = ("member1__username", "member2__username")
    list_filter = ("created_at",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "dialog", "sender", "short_text", "is_read", "created_at")
    search_fields = ("sender__username", "text")
    list_filter = ("is_read", "created_at")

    def short_text(self, obj):
        if obj.text:
            value = obj.text[:50]
            if len(obj.text) > 50:
                value += "..."
            return value
        if obj.image:
            return "[image]"
        return ""

    short_text.short_description = "Content preview"
