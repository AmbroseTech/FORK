from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Enum, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, TZDateTime, UUIDMixin


class UserRole(str, enum.Enum):
    USER = "USER"
    MODERATOR = "MODERATOR"
    ADMIN = "ADMIN"


class Visibility(str, enum.Enum):
    PUBLIC = "PUBLIC"
    CONNECTIONS = "CONNECTIONS"
    PRIVATE = "PRIVATE"


class User(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), default=UserRole.USER, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    last_login_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    trial_simulations_remaining: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    referral_code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    referred_by_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    profile: Mapped[Profile | None] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class Profile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    bio: Mapped[str] = mapped_column(Text, default="", nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    location: Mapped[str | None] = mapped_column(String(120))
    interests: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    social_links: Mapped[dict[str, str]] = mapped_column(JSON, default=dict, nullable=False)
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility, name="visibility"), default=Visibility.PUBLIC, nullable=False)
    theme_preference: Mapped[str] = mapped_column(String(8), default="dark", nullable=False)
    notification_preferences: Mapped[dict[str, bool]] = mapped_column(JSON, default=dict, nullable=False)

    user: Mapped[User] = relationship(back_populates="profile")


class Session(UUIDMixin, TimestampMixin, Base):
    """Refresh-token sessions. Only the token hash is stored."""

    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(TZDateTime(), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(TZDateTime())


class TermsAcceptance(UUIDMixin, Base):
    __tablename__ = "terms_acceptances"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    terms_version: Mapped[str] = mapped_column(String(32), nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(TZDateTime(), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64))


class AuditLog(UUIDMixin, Base):
    __tablename__ = "audit_logs"

    actor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[str | None] = mapped_column(String(64))
    target_id: Mapped[str | None] = mapped_column(String(64))
    metadata_: Mapped[dict[str, object]] = mapped_column("metadata", JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), nullable=False)


Index("ix_audit_logs_created_at", AuditLog.created_at)
