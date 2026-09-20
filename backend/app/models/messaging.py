from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, TZDateTime, UUIDMixin


class MessageType(str, enum.Enum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    VOICE = "VOICE"
    SYSTEM = "SYSTEM"


class CallStatus(str, enum.Enum):
    CALLING = "CALLING"
    CONNECTING = "CONNECTING"
    CONNECTED = "CONNECTED"
    ENDED = "ENDED"
    MISSED = "MISSED"
    DECLINED = "DECLINED"
    BUSY = "BUSY"
    FAILED = "FAILED"


class Conversation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "conversations"

    is_group: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    title: Mapped[str | None] = mapped_column(String(120))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    last_message_at: Mapped[datetime | None] = mapped_column(TZDateTime(), index=True)


class ConversationMember(UUIDMixin, Base):
    __tablename__ = "conversation_members"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_conversation_member"),)

    conversation_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at: Mapped[datetime] = mapped_column(TZDateTime(), nullable=False)
    last_read_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Message(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[MessageType] = mapped_column(Enum(MessageType, name="message_type"), default=MessageType.TEXT)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("messages.id", ondelete="SET NULL"))
    client_id: Mapped[str | None] = mapped_column(String(64))


Index("ix_messages_conversation_created", Message.conversation_id, Message.created_at.desc())


class MessageAttachment(UUIDMixin, Base):
    __tablename__ = "message_attachments"

    message_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    media_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("media_files.id", ondelete="CASCADE"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class MediaFile(UUIDMixin, TimestampMixin, Base):
    """Metadata only; bytes live in local storage or S3-compatible storage."""

    __tablename__ = "media_files"

    owner_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(96), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class VoiceNote(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "voice_notes"

    message_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, unique=True)
    media_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("media_files.id", ondelete="CASCADE"), nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    waveform: Mapped[list[int]] = mapped_column(JSON, default=list, nullable=False)


class CallSession(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "call_sessions"

    conversation_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    caller_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    callee_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_video: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[CallStatus] = mapped_column(Enum(CallStatus, name="call_status"), default=CallStatus.CALLING, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    ended_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    end_reason: Mapped[str | None] = mapped_column(String(32))


class NotificationType(str, enum.Enum):
    FRIEND_REQUEST = "FRIEND_REQUEST"
    FRIEND_ACCEPTED = "FRIEND_ACCEPTED"
    MATCH = "MATCH"
    MESSAGE = "MESSAGE"
    PAYMENT = "PAYMENT"
    SUBSCRIPTION = "SUBSCRIPTION"
    TRIAL = "TRIAL"
    USAGE_RESET = "USAGE_RESET"
    COMMENT = "COMMENT"
    CALL = "CALL"
    SHARE = "SHARE"
    REFERRAL = "REFERRAL"
    SYSTEM = "SYSTEM"


class Notification(UUIDMixin, Base):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType, name="notification_type"), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    link: Mapped[str | None] = mapped_column(String(255))
    data: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), nullable=False)


Index("ix_notifications_user_created", Notification.user_id, Notification.created_at.desc())
Index("ix_notifications_user_unread", Notification.user_id, Notification.read_at)
