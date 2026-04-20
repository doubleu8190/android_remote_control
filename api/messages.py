from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from engine.engine_manager import get_engine_for_user
import logging
import json
import uuid

from model.models_api import (
    SendMessageRequest,
    SendMessageResponse,
    MessageResponse,
    MessageRole,
    MessageStatus
)
from .auth import get_current_active_user, UserInDB
from infra.database import get_db
from model.models_db import Session as DBSession, Message as DBMessage

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
        metadata=db_message.message_metadata  # 使用重命名的属性
    )


@router.post("/send", response_model=SendMessageResponse)
async def send_message(
    request: SendMessageRequest,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """发送消息并获取AI响应（非流式）"""
    # 获取或创建会话
    session_id = request.session_id
    logging.info(f"发送消息到会话: {session_id}")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="会话不存在，请先创建会话"
        )
    else:
        # 验证会话存在且属于当前用户
        db_session = db.query(DBSession)\
            .filter(
                DBSession.id == session_id,
                DBSession.user_id == current_user.id
        )\
            .first()

        if not db_session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="会话不存在"
            )

    # 保存用户消息到数据库
    user_message_id = str(uuid.uuid4())
    user_message = DBMessage(
        id=user_message_id,
        session_id=session_id,
        content=request.message,
        role=MessageRole.USER,
        status=MessageStatus.SENT,
        timestamp=datetime.now()
    )
    db.add(user_message)

    # 更新会话的更新时间
    db_session.updated_at = datetime.now()

    db.commit()
    db.refresh(user_message)
    logging.info(f"保存用户消息到 {session_id}: {user_message}")

    # 获取AI引擎并生成响应
    engine_wrapper = get_engine_for_user(current_user.id)
    try:
        ai_response = engine_wrapper.process_message(
            session_id, request.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI处理错误: {str(e)}"
        )

    # 保存AI响应到数据库
    ai_message_id = str(uuid.uuid4())
    ai_message = DBMessage(
        id=ai_message_id,
        session_id=session_id,
        content=ai_response,
        role=MessageRole.ASSISTANT,
        status=MessageStatus.SENT,
        timestamp=datetime.now()
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    # 构建响应
    return SendMessageResponse(
        message_id=ai_message_id,
        content=ai_response,
        role=MessageRole.ASSISTANT,
        timestamp=datetime.now(),
        session_id=session_id,
        stream=False
    )


@router.post("/send/stream")
async def send_message_stream(
    request: SendMessageRequest,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """发送消息并获取AI响应（流式）"""
    # 获取或创建会话
    session_id = request.session_id
    if not session_id:
        # 创建新会话
        session_id = str(uuid.uuid4())
        db_session = DBSession(
            id=session_id,
            user_id=current_user.id,
            title="新聊天",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
    else:
        # 验证会话存在且属于当前用户
        db_session = db.query(DBSession)\
            .filter(
                DBSession.id == session_id,
                DBSession.user_id == current_user.id
        )\
            .first()

        if not db_session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="会话不存在"
            )

    # 保存用户消息到数据库
    user_message_id = str(uuid.uuid4())
    user_message = DBMessage(
        id=user_message_id,
        session_id=session_id,
        content=request.message,
        role=MessageRole.USER,
        status=MessageStatus.SENT,
        timestamp=datetime.now()
    )
    db.add(user_message)

    # 更新会话的更新时间
    db_session.updated_at = datetime.now()

    db.commit()
    db.refresh(user_message)

    # 获取AI引擎
    _ = get_engine_for_user(current_user.id)

    async def generate_stream():
        """生成流式响应"""
        # 模拟流式响应（在实际应用中，这里应该调用真正的流式AI接口）

        # 发送思考过程
        yield f"data: {json.dumps({'type': 'thinking', 'content': '正在思考...'})}\n\n"

        # 模拟分块响应
        words = f"您好！我是AI助手。您说：{request.message}\n\n我会尽力帮助您解决这个问题。"
        for i, chunk in enumerate(words.split()):
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk + ' ', 'chunk_id': i})}\n\n"
            import asyncio
            await asyncio.sleep(0.1)

        # 发送完整响应
        full_response = f"您好！我是AI助手。您说：{request.message}\n\n我会尽力帮助您解决这个问题。"
        yield f"data: {json.dumps({'type': 'complete', 'content': full_response, 'message_id': str(uuid.uuid4())})}\n\n"

        # 保存AI响应到数据库（在实际应用中，应该在收到完整响应后保存）
        ai_message_id = str(uuid.uuid4())
        ai_message = DBMessage(
            id=ai_message_id,
            session_id=session_id,
            content=full_response,
            role=MessageRole.ASSISTANT,
            status=MessageStatus.SENT,
            timestamp=datetime.now()
        )
        db.add(ai_message)
        db.commit()

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # 禁用Nginx缓冲
        }
    )


@router.get("/history", response_model=List[MessageResponse])
async def get_message_history(
    session_id: str = Query(..., description="会话ID"),
    skip: int = 0,
    limit: int = 100,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取会话的消息历史"""
    # 验证会话存在且属于当前用户
    db_session = db.query(DBSession)\
        .filter(
            DBSession.id == session_id,
            DBSession.user_id == current_user.id
    )\
        .first()

    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="会话不存在"
        )

    # 查询消息，按时间顺序排列
    db_messages = db.query(DBMessage)\
        .filter(DBMessage.session_id == session_id)\
        .order_by(DBMessage.timestamp.asc())\
        .offset(skip)\
        .limit(limit)\
        .all()\

    # 转换为响应模型
    return [message_to_response(msg) for msg in db_messages]


@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    session_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """删除消息"""
    # 验证会话存在且属于当前用户
    db_session = db.query(DBSession)\
        .filter(
            DBSession.id == session_id,
            DBSession.user_id == current_user.id
    )\
        .first()

    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="会话不存在"
        )

    # 查找消息
    db_message = db.query(DBMessage)\
        .filter(
            DBMessage.id == message_id,
            DBMessage.session_id == session_id
    )\
        .first()

    if not db_message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="消息不存在"
        )

    # 删除消息
    db.delete(db_message)
    db.commit()

    return {"message": "消息已删除"}
