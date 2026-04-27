from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.engine.engine_manager import engine_manager
import logging

from backend.model.models_api import (
    SendMessageRequest,
    SendMessageResponse,
    MessageResponse,
    MessageRole,
)
from .auth import get_current_active_user, UserInDB
from backend.infra.database import get_db
from backend.model.models_db import Session as DBSession, Message as DBMessage

router = APIRouter(prefix="/api/messages", tags=["messages"])


def message_to_response(db_message: DBMessage) -> MessageResponse:
    """将数据库消息对象转换为响应模型"""
    return MessageResponse(
        id=db_message.id,
        content=db_message.content,
        role=db_message.role,
        status=db_message.status,
        timestamp=db_message.timestamp,
        session_id=db_message.session_id,
        metadata=db_message.message_metadata,  # 使用重命名的属性
    )


@router.post("/send", response_model=SendMessageResponse)
async def send_message(
    request: SendMessageRequest,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """发送消息并获取AI响应（非流式）"""
    # 获取或创建会话
    session_id = request.session_id
    logging.info(f"发送消息到会话: {session_id}")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="会话不存在，请先创建会话"
        )

    # 验证会话存在且属于当前用户
    db_session = (
        db.query(DBSession)
        .filter(DBSession.id == session_id, DBSession.user_id == current_user.id)
        .first()
    )

    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="会话不存在"
        )

    # 获取AI引擎并生成响应
    try:
        engine = engine_manager.get_or_create_engine(db_session, db)
        if not engine:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="AI引擎初始化失败",
            )
        ai_response = engine.chat(request.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI处理错误: {str(e)}",
        )

    # 获取最新一条 AI 消息的 ID（由 RunnableWithMessageHistory 自动写入）
    db_message = (
        db.query(DBMessage)
        .filter(
            DBMessage.session_id == session_id,
            DBMessage.role == MessageRole.ASSISTANT,
        )
        .order_by(DBMessage.timestamp.desc())
    ).first()
    # 构建响应
    return SendMessageResponse(
        message_id=db_message.id if db_message else "",
        content=ai_response,
        role=MessageRole.ASSISTANT,
        timestamp=datetime.now(),
        session_id=session_id,
        stream=False,
    )


@router.get("/history", response_model=List[MessageResponse])
async def get_message_history(
    session_id: str = Query(..., description="会话ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """获取会话的消息历史"""
    # 验证会话存在且属于当前用户
    db_session = (
        db.query(DBSession)
        .filter(DBSession.id == session_id, DBSession.user_id == current_user.id)
        .first()
    )

    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="会话不存在"
        )

    # 查询消息，按时间顺序排列
    db_messages = (
        db.query(DBMessage)
        .filter(DBMessage.session_id == session_id)
        .order_by(DBMessage.timestamp.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    # 转换为响应模型
    return [message_to_response(msg) for msg in db_messages]


@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    session_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """删除消息"""
    # 验证会话存在且属于当前用户
    db_session = (
        db.query(DBSession)
        .filter(DBSession.id == session_id, DBSession.user_id == current_user.id)
        .first()
    )

    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="会话不存在"
        )

    # 查找消息
    db_message = (
        db.query(DBMessage)
        .filter(DBMessage.id == message_id, DBMessage.session_id == session_id)
        .first()
    )

    if not db_message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="消息不存在")

    # 删除消息
    db.delete(db_message)
    db.commit()

    return {"message": "消息已删除"}
