from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,32}$")


class SignupRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=64)
    accept_terms: bool
    referral_code: str | None = Field(default=None, max_length=16)

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        v = v.strip().lower()
        if not USERNAME_RE.match(v):
            raise ValueError("Username must be 3-32 characters: lowercase letters, numbers, underscores")
        return v

    @field_validator("accept_terms")
    @classmethod
    def _terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the Terms of Service and Privacy Policy")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    display_name: str
    bio: str
    avatar_url: str | None
    location: str | None
    interests: list[str]
    skills: list[str]
    social_links: dict[str, str]
    visibility: str
    theme_preference: str
    notification_preferences: dict[str, bool]


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=64)
    bio: str | None = Field(default=None, max_length=600)
    avatar_url: str | None = Field(default=None, max_length=512)
    location: str | None = Field(default=None, max_length=120)
    interests: list[str] | None = Field(default=None, max_length=12)
    skills: list[str] | None = Field(default=None, max_length=12)
    social_links: dict[str, str] | None = None
    visibility: str | None = Field(default=None, pattern="^(PUBLIC|CONNECTIONS|PRIVATE)$")
    theme_preference: str | None = Field(default=None, pattern="^(dark|light|system)$")
    notification_preferences: dict[str, bool] | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    username: str
    role: str
    email_verified: bool
    trial_simulations_remaining: int
    referral_code: str
    created_at: datetime
    profile: ProfileOut | None = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(BaseModel):
    user: UserOut
    tokens: TokenPair
    # Present only in demo/dev mode so the flow can be completed without an email server.
    dev_verification_token: str | None = None


class MessageResponse(BaseModel):
    message: str
    # Demo/dev only: surfaced so reset can be exercised without an email server.
    dev_token: str | None = None
