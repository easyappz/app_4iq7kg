from typing import Optional, Tuple

from django.utils.translation import gettext_lazy as _
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .models import Member, MemberToken


class MemberTokenAuthentication(BaseAuthentication):
    """Token-based authentication for Member model.

    Expects header: ``Authorization: Token <token_key>``.
    """

    keyword = "Token"

    def authenticate(self, request) -> Optional[Tuple[Member, MemberToken]]:
        """Authenticate the request using a MemberToken.

        If the header is missing or malformed, returns ``None`` to allow
        unauthenticated access where permitted by permissions.
        """

        auth = get_authorization_header(request).split()

        if not auth:
            return None

        try:
            keyword = auth[0].decode()
        except UnicodeDecodeError:
            return None

        if keyword.lower() != self.keyword.lower():
            return None

        # Expect exactly two parts: "Token" and the key value
        if len(auth) != 2:
            return None

        try:
            token_key = auth[1].decode()
        except UnicodeDecodeError:
            return None

        if not token_key:
            return None

        try:
            token = MemberToken.objects.select_related("member").get(key=token_key)
        except MemberToken.DoesNotExist as exc:
            raise AuthenticationFailed(_("Invalid authentication token.")) from exc

        return token.member, token

    def authenticate_header(self, request) -> str:  # pragma: no cover - simple header
        """Return the value for the ``WWW-Authenticate`` header on 401."""

        return f"{self.keyword} realm=\"api\""
