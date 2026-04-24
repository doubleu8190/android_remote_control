"""
SQLAlchemy数据库模型
"""
from typing import Any


from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import uuid

# 从共享基础模块导入Base
from backend.infra.db_base import Base


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 关系
    sessions = relationship(
        "Session",
        back_populates="user",
        cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class Session(Base):
    """会话表"""
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String,
        ForeignKey(
            "users.id",
            ondelete="CASCADE"),
        nullable=False)
    title = Column(String, default="新会话")
    device_ip = Column[str](String)  # 设备IP地址
    device_port = Column[int](Integer)  # 设备端口号
    llm_config_id = Column(String)  # LLM配置ID
    session_metadata = Column(
        "metadata",
        JSON,
        nullable=True)  # 存储会话元数据（重命名列以避免冲突）
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 关系
    user = relationship("User", back_populates="sessions")
    messages = relationship(
        "Message",
        back_populates="session",
        cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Session(id={self.id}, title={self.title}, user_id={self.user_id})>"


class Message(Base):
    """消息表"""
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(
        String,
        ForeignKey(
            "sessions.id",
            ondelete="CASCADE"),
        nullable=False)
    content = Column(Text, nullable=False)
    role = Column(String, nullable=False)  # 'user', 'assistant', 'system'
    status = Column(String, default="sent")  # 'sent', 'pending', 'failed'
    message_metadata = Column(
        "metadata",
        JSON,
        nullable=True)  # 存储消息元数据（重命名列以避免冲突）
    timestamp = Column(DateTime, default=datetime.now)

    # 关系
    session = relationship("Session", back_populates="messages")

    def __repr__(self):
        return f"<Message(id={self.id}, role={self.role}, session_id={self.session_id})>"


class LLMConfig(Base):
    """LLM配置表"""
    __tablename__ = "llm_configs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String,
        ForeignKey(
            "users.id",
            ondelete="CASCADE"),
        nullable=False)
    api_key = Column(String, nullable=False)  # 加密存储
    base_url = Column(String, nullable=False)
    model = Column(String, nullable=False)
    temperature = Column(Float, nullable=False)  # 0-1之间
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 关系
    user = relationship("User")

    def __repr__(self):
        return f"<LLMConfig(id={self.id}, model={self.model}, user_id={self.user_id})>"
