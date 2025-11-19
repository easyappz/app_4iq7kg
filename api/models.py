from django.db import models


class Member(models.Model):
    """Member represents a user of the social network.

    This model is intentionally independent from Django's auth.User.
    """

    username = models.CharField(max_length=150, unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    bio = models.TextField(blank=True)
    birth_date = models.DateField(null=True, blank=True)
    avatar = models.CharField(max_length=500, blank=True)
    password = models.CharField(max_length=128)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.username


class MemberToken(models.Model):
    """Authentication token for Member.

    Stores a single token string per (possibly multiple) sessions.
    """

    key = models.CharField(max_length=40, primary_key=True)
    member = models.ForeignKey(
        Member,
        related_name="tokens",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Token for {self.member.username}"


class Post(models.Model):
    """Post created by a member.

    Supports text and an optional image reference.
    """

    author = models.ForeignKey(
        Member,
        related_name="posts",
        on_delete=models.CASCADE,
    )
    text = models.TextField()
    image = models.CharField(max_length=500, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        preview = self.text[:30]
        if len(self.text) > 30:
            preview += "..."
        return f"Post #{self.pk} by {self.author.username}: {preview}"


class PostLike(models.Model):
    """A like on a post by a member.

    Each (member, post) pair is unique.
    """

    member = models.ForeignKey(
        Member,
        related_name="post_likes",
        on_delete=models.CASCADE,
    )
    post = models.ForeignKey(
        Post,
        related_name="likes",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["member", "post"],
                name="unique_post_like",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.member.username} likes Post #{self.post_id}"


class Comment(models.Model):
    """Comment on a post with optional parent for threaded replies."""

    post = models.ForeignKey(
        Post,
        related_name="comments",
        on_delete=models.CASCADE,
    )
    author = models.ForeignKey(
        Member,
        related_name="comments",
        on_delete=models.CASCADE,
    )
    text = models.TextField()
    parent = models.ForeignKey(
        "self",
        related_name="replies",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        preview = self.text[:30]
        if len(self.text) > 30:
            preview += "..."
        return f"Comment #{self.pk} by {self.author.username}: {preview}"


class CommentLike(models.Model):
    """A like on a comment by a member.

    Each (member, comment) pair is unique.
    """

    member = models.ForeignKey(
        Member,
        related_name="comment_likes",
        on_delete=models.CASCADE,
    )
    comment = models.ForeignKey(
        Comment,
        related_name="likes",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["member", "comment"],
                name="unique_comment_like",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.member.username} likes Comment #{self.comment_id}"


class Subscription(models.Model):
    """One-way subscription (follow) between members.

    follower -> following
    Each pair is unique.
    """

    follower = models.ForeignKey(
        Member,
        related_name="following",
        on_delete=models.CASCADE,
    )
    following = models.ForeignKey(
        Member,
        related_name="followers",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["follower", "following"],
                name="unique_subscription",
            ),
            models.CheckConstraint(
                check=~models.Q(follower=models.F("following")),
                name="subscription_prevent_self_follow",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.follower.username} follows {self.following.username}"


class Dialog(models.Model):
    """Direct dialog between two members.

    The pair (member1, member2) is unique regardless of order.
    Ordering is enforced in save() so that member1_id < member2_id.
    """

    member1 = models.ForeignKey(
        Member,
        related_name="dialogs_as_member1",
        on_delete=models.CASCADE,
    )
    member2 = models.ForeignKey(
        Member,
        related_name="dialogs_as_member2",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["member1", "member2"],
                name="unique_dialog_members",
            ),
        ]

    def save(self, *args, **kwargs) -> None:
        """Ensure a canonical ordering of members.

        This allows the unique constraint on (member1, member2) to guarantee
        that there is at most one dialog per unordered pair of members.
        """

        if self.member1_id is not None and self.member2_id is not None:
            if self.member1_id > self.member2_id:
                self.member1, self.member2 = self.member2, self.member1
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Dialog #{self.pk} between {self.member1.username} and {self.member2.username}"


class Message(models.Model):
    """Message inside a dialog.

    At validation level (later), at least one of text or image will be required.
    """

    dialog = models.ForeignKey(
        Dialog,
        related_name="messages",
        on_delete=models.CASCADE,
    )
    sender = models.ForeignKey(
        Member,
        related_name="messages",
        on_delete=models.CASCADE,
    )

    text = models.TextField(blank=True)
    image = models.CharField(max_length=500, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        if self.text:
            preview = self.text[:30]
            if len(self.text) > 30:
                preview += "..."
            return f"Message #{self.pk} in Dialog #{self.dialog_id}: {preview}"
        if self.image:
            return f"Message #{self.pk} in Dialog #{self.dialog_id}: [image]"
        return f"Message #{self.pk} in Dialog #{self.dialog_id}"
