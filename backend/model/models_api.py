from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid
import re

# ==================== 枚举类型 ====================


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class MessageStatus(str, Enum):
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    ERROR = "error"

# ==================== 请求/响应模型 ====================


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not v or len(v.strip()) < 3:
            raise ValueError('用户名至少需要3个字符')
        if len(v) > 50:
            raise ValueError('用户名不能超过50个字符')
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('用户名只能包含字母、数字、下划线和连字符')
        return v.strip().lower()

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError('密码至少需要6个字符')
        if len(v) > 128:
            raise ValueError('密码不能超过128个字符')
        return v

    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == '':
            return None
        if len(v) > 100:
            raise ValueError('姓名不能超过100个字符')
        return v.strip()


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = None


class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[str] = None

# ==================== 消息模型 ====================


class MessageBase(BaseModel):
    content: str
    role: MessageRole = MessageRole.USER
    status: MessageStatus = MessageStatus.SENT
    metadata: Optional[Dict[str, Any]] = None


class MessageCreate(MessageBase):
    pass


class MessageResponse(MessageBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.now)
    session_id: str

    model_config = ConfigDict(from_attributes=True)

# ==================== 会话模型 ====================


class SessionBase(BaseModel):
    title: str = "New Chat"
    device_ip: Optional[str] = None
    device_port: Optional[int] = None
    llm_config_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SessionCreate(SessionBase):
    pass


class SessionResponse(SessionBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    messages: List[MessageResponse] = []
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    device_ip: Optional[str] = None
    device_port: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

# ==================== 聊天请求/响应 ====================


class SendMessageRequest(BaseModel):
    message: str
    stream: bool = False
    session_id: Optional[str] = None  # 如果为空，创建新会话


class SendMessageResponse(BaseModel):
    message_id: str
    content: str
    role: MessageRole
    timestamp: datetime
    session_id: str
    stream: bool = False


class StreamChunk(BaseModel):
    type: str  # 'text', 'tool_call', 'tool_result', 'error', 'done'
    data: str
    message_id: Optional[str] = None


class ChatResponse(BaseModel):
    success: bool = True
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)

# ==================== 数据库模型（模拟） ====================


class UserInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    is_active: bool = True


class SessionInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    messages: List[Dict[str, Any]] = []  # 存储消息字典
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    metadata: Optional[Dict[str, Any]] = None


class MessageInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    content: str
    role: MessageRole = MessageRole.USER
    status: MessageStatus = MessageStatus.SENT
    timestamp: datetime = Field(default_factory=datetime.now)
    metadata: Optional[Dict[str, Any]] = None


# ==================== LLM配置模型 ====================


class LLMConfigBase(BaseModel):
    base_url: str
    model: str
    temperature: float = Field(0.7, ge=0, le=1)


class LLMConfigCreate(LLMConfigBase):
    api_key: str

    @field_validator('api_key')
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        if not v or len(v) < 10:
            raise ValueError('API密钥至少需要10个字符')
        if len(v) > 200:
            raise ValueError('API密钥不能超过200个字符')
        return v

    @field_validator('base_url')
    @classmethod
    def validate_base_url(cls, v: str) -> str:
        if not v:
            raise ValueError('基础URL不能为空')
        if len(v) > 200:
            raise ValueError('基础URL不能超过200个字符')
        # 简单的URL格式验证
        if not re.match(r'^https?://', v):
            raise ValueError('基础URL必须以http://或https://开头')
        return v

    @field_validator('model')
    @classmethod
    def validate_model(cls, v: str) -> str:
        if not v:
            raise ValueError('模型名称不能为空')
        if len(v) > 100:
            raise ValueError('模型名称不能超过100个字符')
        return v


class LLMConfigUpdate(BaseModel):
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0, le=1)
    is_active: Optional[bool] = None

    @field_validator('api_key')
    @classmethod
    def validate_api_key(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v) < 10:
                raise ValueError('API密钥至少需要10个字符')
            if len(v) > 200:
                raise ValueError('API密钥不能超过200个字符')
        return v

    @field_validator('base_url')
    @classmethod
    def validate_base_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v) > 200:
                raise ValueError('基础URL不能超过200个字符')
            # 简单的URL格式验证
            if not re.match(r'^https?://', v):
                raise ValueError('基础URL必须以http://或https://开头')
        return v

    @field_validator('model')
    @classmethod
    def validate_model(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v) > 100:
                raise ValueError('模型名称不能超过100个字符')
        return v


class LLMConfigResponse(LLMConfigBase):
    id: str
    user_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
