from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from backend.model.models_db import Message as DBMessage, MessageStatus, MessageRole



class SQLAlchemyMessageHistory(BaseChatMessageHistory):
    """自定义的消息历史类，用于将对话存储到你自己的messages表中。"""

    def __init__(self, session_id: str, db_session: Session):
        self.session_id = session_id
        self.db_session = db_session

    @property
    def messages(self) -> List[BaseMessage]:  # 1️⃣ 核心接口：从DB加载消息
        """从数据库中加载当前会话的所有消息，并转换为LangChain的消息格式。"""
        db_messages = (
            self.db_session.query(DBMessage)
            .filter(DBMessage.session_id == self.session_id)
            .order_by(DBMessage.created_at)
            .all()
        )

        # 将你的Message对象转换为LangChain的BaseMessage对象
        langchain_messages = []
        for msg in db_messages:
            # 调用实例方法转换消息
            langchain_messages.append(self.convert_db_message_to_langchain(msg))
        return langchain_messages

    def convert_db_message_to_langchain(self, db_message: DBMessage) -> BaseMessage:
        role = db_message.role.lower()
        content = db_message.content

        if role == MessageRole.USER.value:
            return HumanMessage(content=content)
        elif role == MessageRole.ASSISTANT.value:
            return AIMessage(content=content)
        elif role == MessageRole.SYSTEM.value:
            return SystemMessage(content=content)
        elif role == MessageRole.TOOL.value:
            return ToolMessage(content=content)
        else:
            return HumanMessage(content=content)

    @property
    def db_messages(self) -> List[DBMessage]:  # 1️⃣ 核心接口：从DB加载消息
        """从数据库中加载当前会话的所有消息。"""
        db_messages = (
            self.db_session.query(DBMessage)
            .filter(DBMessage.session_id == self.session_id)
            .order_by(DBMessage.created_at)
            .all()
        )
        return db_messages

    def add_message(self, message: BaseMessage) -> None:  # 2️⃣ 核心接口：添加单条消息
        """向数据库中添加一条新消息。"""
        db_message = DBMessage(
            session_id=self.session_id,
            role=self._get_role(
                message
            ),  # 需要实现一个函数，将LangChain消息类型映射到你的role字段
            content=message.content,
            status=MessageStatus.SENT,
            created_at=datetime.now(),
        )
        self.db_session.add(db_message)
        self.db_session.commit()

    def clear(self) -> None:  # 清理会话所有消息 (可选)
        """清除当前会话的所有消息。"""
        self.db_session.query(DBMessage).filter(
            DBMessage.session_id == self.session_id
        ).delete()
        self.db_session.commit()

    def _get_role(self, message: BaseMessage) -> MessageRole:
        if isinstance(message, HumanMessage):
            return MessageRole.USER
        elif isinstance(message, AIMessage):
            return MessageRole.ASSISTANT
        elif isinstance(message, SystemMessage):
            return MessageRole.SYSTEM
        elif isinstance(message, ToolMessage):
            return MessageRole.TOOL
        else:
            return MessageRole.USER

    # 以下两个方法是LangChain的完整接口定义通常需要的，提供基本实现即可。
    def __len__(self):
        return len(self.langchain_messages)

    def __bool__(self):
        return bool(self.langchain_messages)
