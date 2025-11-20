from django.contrib.auth.hashers import make_password
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Member, MemberToken, Post, PostMedia


class PostMediaUploadTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.member = Member.objects.create(
            username="tester",
            first_name="Test",
            last_name="User",
            bio="",
            birth_date=None,
            avatar="",
            password=make_password("password123"),
        )
        self.token = MemberToken.objects.create(key="testtoken", member=self.member)

    def _auth_headers(self) -> dict:
        return {"HTTP_AUTHORIZATION": f"Token {self.token.key}"}

    def test_create_post_with_image_and_video_attachments(self) -> None:
        image_file = SimpleUploadedFile(
            "test.jpg",
            b"\xff\xd8\xff",
            content_type="image/jpeg",
        )
        video_file = SimpleUploadedFile(
            "test.mp4",
            b"00",
            content_type="video/mp4",
        )

        data = {
            "text": "Post with image and video",
            "files": [image_file, video_file],
        }

        response = self.client.post(
            "/api/posts/",
            data,
            format="multipart",
            **self._auth_headers(),
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Post.objects.count(), 1)
        post = Post.objects.first()
        assert post is not None

        self.assertEqual(PostMedia.objects.filter(post=post).count(), 2)

        media_items = response.data.get("media")
        self.assertIsInstance(media_items, list)
        self.assertEqual(len(media_items), 2)

        types = {item["media_type"] for item in media_items}
        self.assertEqual(types, {"image", "video"})

        for item in media_items:
            self.assertIn("file", item)
            self.assertIsInstance(item["file"], str)
            self.assertNotEqual(item["file"], "")

    def test_create_post_rejects_unsupported_file_type(self) -> None:
        bad_file = SimpleUploadedFile(
            "test.txt",
            b"hello",
            content_type="text/plain",
        )

        data = {
            "text": "Post with invalid file",
            "files": [bad_file],
        }

        response = self.client.post(
            "/api/posts/",
            data,
            format="multipart",
            **self._auth_headers(),
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("files", response.data)
        self.assertIn("Допустимы только изображения и видео.", response.data["files"][0])

        self.assertEqual(Post.objects.count(), 0)
        self.assertEqual(PostMedia.objects.count(), 0)
