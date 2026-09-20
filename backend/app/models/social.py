from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, TZDateTime, UUIDMixin
from app.models.user import Visibility


class FriendRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class FriendRequest(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "friend_requests"
    __table_args__ = (UniqueConstraint("sender_id", "receiver_id", name="uq_friend_request_pair"),)

    sender_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    receiver_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[FriendRequestStatus] = mapped_column(
        Enum(FriendRequestStatus, name="friend_request_status"), default=FriendRequestStatus.PENDING, nullable=False
    )
    message: Mapped[str | None] = mapped_column(String(280))
    responded_at: Mapped[datetime | None] = mapped_column(TZDateTime())


class Match(UUIDMixin, TimestampMixin, Base):
    """A mutual connection. user_a_id < user_b_id is enforced by the service layer."""

    __tablename__ = "matches"
    __table_args__ = (UniqueConstraint("user_a_id", "user_b_id", name="uq_match_pair"),)

    user_a_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_b_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("conversations.id", ondelete="SET NULL"))


class Block(UUIDMixin, Base):
    __tablename__ = "blocks"
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_block_pair"),)

    blocker_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    blocked_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), nullable=False)


class SharedPost(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "shared_posts"

    author_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    decision_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("decisions.id", ondelete="SET NULL"))
    media_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility, name="visibility", create_type=False), default=Visibility.PUBLIC, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Comment(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "comments"

    author_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("shared_posts.id", ondelete="CASCADE"), index=True)
    decision_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("decisions.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("comments.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class BusinessProfile(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "business_profiles"

    owner_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    tagline: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(512))
    website: Mapped[str | None] = mapped_column(String(255))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    contact_phone: Mapped[str | None] = mapped_column(String(32))
    location: Mapped[str | None] = mapped_column(String(120))
    services: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    image_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility, name="visibility", create_type=False), default=Visibility.PUBLIC, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class PortfolioItem(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "portfolio_items"

    owner_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    technologies: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    project_url: Mapped[str | None] = mapped_column(String(512))
    github_url: Mapped[str | None] = mapped_column(String(512))
    demo_url: Mapped[str | None] = mapped_column(String(512))
    media_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility, name="visibility", create_type=False), default=Visibility.PUBLIC, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ReportStatus(str, enum.Enum):
    OPEN = "OPEN"
    REVIEWING = "REVIEWING"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class Report(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "reports"

    reporter_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(64), nullable=False)
    details: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus, name="report_status"), default=ReportStatus.OPEN, nullable=False, index=True)
    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    resolved_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    resolution_note: Mapped[str | None] = mapped_column(Text)


class UserInvite(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "user_invites"

    inviter_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(24), nullable=False)
    code: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    invitee_hint: Mapped[str | None] = mapped_column(String(255))


class Referral(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "referrals"
    __table_args__ = (UniqueConstraint("referred_id", name="uq_referral_referred"),)

    referrer_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    referred_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(16), nullable=False)
    reward_trials: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rewarded_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    flagged_reason: Mapped[str | None] = mapped_column(String(120))
