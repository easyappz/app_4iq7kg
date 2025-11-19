from django.urls import path

from .views import (
    CurrentMemberView,
    HelloView,
    LoginView,
    LogoutView,
    RegisterView,
)

urlpatterns = [
    path("hello/", HelloView.as_view(), name="hello"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", CurrentMemberView.as_view(), name="auth-me"),
]
