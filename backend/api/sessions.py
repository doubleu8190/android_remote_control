from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from .auth import get_current_active_user, UserInDB
from backend.infra.database import get_db
from backend.model.models_db import Session as DBSession
import logging
import uuid
from pydantic import BaseModel

# 导入scrcpy服务管理器
from backend.infra.scrcpy_service_manager import scrcpy_service_manager

from backend.model.models_api import (
    SessionCreate,
    SessionResponse,
    SessionUpdate,
    MessageResponse,
)


router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def session_to_response(db_session: DBSession) -> SessionResponse:
    """将数据库会话对象转换为响应模型"""
    # 获取会话的所有消息
    messages = [
        MessageResponse(
            id=msg.id,
            content=msg.content,
            role=msg.role,
            status=msg.status,
            timestamp=msg.timestamp,
            session_id=db_session.id,
            metadata=msg.message_metadata,  # 使用重命名的属性
        )
        for msg in db_session.messages
    ]

    return SessionResponse(
        id=db_session.id,
        user_id=db_session.user_id,
        title=db_session.title,
        device_ip=db_session.device_ip,
        device_port=db_session.device_port,
        messages=messages,
        created_at=db_session.created_at,
        updated_at=db_session.updated_at,
        metadata=db_session.session_metadata,  # 使用重命名的属性
    )


@router.get("/list", response_model=List[SessionResponse])
async def list_sessions(
    skip: int = 0,
    limit: int = 100,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的会话列表"""
    # 查询用户的会话，按更新时间倒序排列
    db_sessions = (
        db.query(DBSession)
        .filter(DBSession.user_id == current_user.id)
        .order_by(DBSession.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # 转换为响应模型
    return [session_to_response(session) for session in db_sessions]


@router.post("/", response_model=SessionResponse)
async def create_session(
    session_data: SessionCreate,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """创建新会话"""
    try:
        # 使用UUID保证唯一性，不再检查重复标题（因为标题可以相同）
        session_id = str(uuid.uuid4())

        # 检查是否存在相同时间戳的会话（防止重复提交）
        if session_data.metadata and "timestamp" in session_data.metadata:
            existing_session = (
                db.query(DBSession)
                .filter(
                    DBSession.user_id == current_user.id,
                    DBSession.session_metadata.contains(
                        {"timestamp": session_data.metadata["timestamp"]}
                    ),
                )
                .first()
            )
            if existing_session:
                return session_to_response(existing_session)
        now = datetime.now()
        db_session = DBSession(
            id=session_id,
            user_id=current_user.id,
            title=session_data.title or f"新会话 {now.strftime('%Y-%m-%d %H:%M:%S')}",
            device_ip=session_data.device_ip,
            device_port=session_data.device_port,
            session_metadata=session_data.metadata,
            created_at=now,
            updated_at=now,
        )

        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        logging.info(f"创建会话: {db_session}")
        return session_to_response(db_session)
    except Exception as e:
        db.rollback()
        logging.error(f"创建会话失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建会话失败: {str(e)}",
        )


@router.get("", response_model=SessionResponse)
async def get_session(
    session_id: str = Query(..., description="会话ID"),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """获取特定会话详情"""
    # 查询会话，确保属于当前用户
    db_session = (
        db.query(DBSession)
        .filter(DBSession.id == session_id, DBSession.user_id == current_user.id)
        .first()
    )
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="会话不存在"
        )

    return session_to_response(db_session)


@router.put("/update", response_model=SessionResponse)
async def update_session(
    session_update: SessionUpdate,
    session_id: str = Query(..., description="会话ID"),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """更新会话信息（如标题）"""
    # 查询会话，确保属于当前用户
    db_session = (
        db.query(DBSession)
        .filter(DBSession.id == session_id, DBSession.user_id == current_user.id)
        .first()
    )
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="会话不存在"
        )

    # 更新字段
    update_data = session_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(db_session, field) and field != "id":
            setattr(db_session, field, value)

    db_session.updated_at = datetime.now()

    db.commit()
    db.refresh(db_session)

    return session_to_response(db_session)


@router.delete("/delete")
async def delete_session(
    session_id: str = Query(..., description="会话ID"),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """删除会话"""
    # 查询会话，确保属于当前用户
    db_session = (
        db.query(DBSession)
        .filter(DBSession.id == session_id, DBSession.user_id == current_user.id)
        .first()
    )
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="会话不存在"
        )

    session_id = db_session.id
    # 删除会话（关联消息将自动删除，因为设置了cascade）
    db.delete(db_session)
    db.commit()

    # 停止对应的scrcpy服务
    try:
        await scrcpy_service_manager.stop_connect_device(session_id)
        logging.info(f"已停止scrcpy服务会话: {session_id}")
    except Exception as e:
        logging.warning(f"停止scrcpy服务时出错: {e}")

    return {"message": "会话已删除"}


class DeviceConnectRequest(BaseModel):
    ip: str
    port: int
    session_id: str


@router.post("/rename")
async def rename_session(
    session_id: str = Query(..., description="会话ID"),
    title: str = Query(..., description="新标题"),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """重命名会话（快捷方式）"""
    # 查询会话，确保属于当前用户
    db_session = (
        db.query(DBSession)
        .filter(DBSession.id == session_id, DBSession.user_id == current_user.id)
        .first()
    )

    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="会话不存在"
        )

    # 更新标题
    db_session.title = title
    db_session.updated_at = datetime.now()

    db.commit()

    return {"message": "会话已重命名", "new_title": title}


@router.put("/device")
async def update_session_device(
    session_id: str = Query(..., description="会话ID"),
    device_ip: str = Query(..., description="设备IP地址"),
    device_port: int = Query(..., description="设备端口号"),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """更新会话的设备IP地址和端口号"""
    # 查询会话，确保属于当前用户
    db_session = (
        db.query(DBSession)
        .filter(DBSession.id == session_id, DBSession.user_id == current_user.id)
        .first()
    )

    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="会话不存在"
        )

    # 更新设备信息
    db_session.device_ip = device_ip
    db_session.device_port = str(device_port)
    db_session.updated_at = datetime.now()

    db.commit()
    db.refresh(db_session)

    return {
        "message": "设备信息已更新",
        "device_ip": device_ip,
        "device_port": device_port,
    }
