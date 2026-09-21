from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    auth_subject: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    email: Mapped[str] = mapped_column(
        String(320),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=UserRole.USER.value,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    documents: Mapped[list["Document"]] = relationship(
        back_populates="uploader",
    )

    audit_logs: Mapped[list["AuditLog"]] = relationship(
        back_populates="user",
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="New Chat",
    )
    is_pinned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    user: Mapped["User"] = relationship(
        back_populates="conversations",
    )

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    provider: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    sources: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    conversation: Mapped["Conversation"] = relationship(
        back_populates="messages",
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(
        String(1024),
        unique=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="processing",
    )
    uploaded_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    uploader: Mapped["User"] = relationship(
        back_populates="documents",
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    resource_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    resource_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )
    user_agent: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    user: Mapped["User | None"] = relationship(
        back_populates="audit_logs",
    )