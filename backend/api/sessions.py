from collections.abc import Set
from datetime import datetime
from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from .auth import get_current_active_user, UserInDB
from backend.infra.database import get_db
from backend.model.models_db import Session as DBSession
import logging
import uuid
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from backend.infra.adb_ctrl import screencap_async

# 导入scrcpy服务管理器
from backend.infra.scrcpy_service_manager import scrcpy_service_manager

from backend.model.models_api import (
    SessionCreate,
    SessionResponse,
    SessionUpdate,
    MessageResponse,
)


router = APIRouter(prefix="/api/sessions", tags=["sessions"])

active_session_store = set[Any]()


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
        llm_config_id=db_session.llm_config_id,
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


@router.post("", response_model=SessionResponse)
async def create_session(
    session_data: SessionCreate,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """创建新会话"""
    try:
        session_id = str(uuid.uuid4())

        existing_session = (
            db.query(DBSession)
            .filter(
                DBSession.user_id == current_user.id,
                DBSession.device_ip == session_data.device_ip,
                DBSession.device_port == session_data.device_port,
            )
            .first()
        )
        if existing_session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="已存在相同 IP 和端口的会话",
            )

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
            llm_config_id=session_data.llm_config_id,
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


class SessionConnectRequest(BaseModel):
    session_id: str


class SessionConnectResponse(BaseModel):
    session_id: str
    device_ip: str
    device_port: int
    title: str
    message: str


@router.post("/connect", response_model=SessionConnectResponse)
async def connect(
    request: SessionConnectRequest,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """连接设备：创建会话（DB持久化 + 内存活跃记录），返回设备IP和端口"""
    try:
        session_id = request.session_id

        # 1. 检查数据库中是否已存在相同设备的会话
        existing_db_session = (
            db.query(DBSession)
            .filter(
                DBSession.user_id == current_user.id,
            )
            .first()
        )
        if not existing_db_session:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "SESSION_NOT_EXISTS",
                    "message": f"设备 {session_id} 不存在会话",
                    "session_id": existing_db_session.id,
                },
            )

        # 2. 检查内存中是否已存在活跃会话
        if session_id in active_session_store:
            existing_info = active_session_store[session_id]
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "SESSION_ALREADY_ACTIVE",
                    "message": f"会话ID {session_id} 已存在活跃会话",
                    "session_id": session_id,
                    "device_ip": existing_info["device_ip"],
                    "device_port": existing_info["device_port"],
                },
            )

        active_session_store.add(session_id)
        logging.info(
            f"会话连接成功 - session_id={session_id}"
        )
        return SessionConnectResponse(
            session_id=session_id,
            device_ip=existing_db_session.device_ip,
            device_port=existing_db_session.device_port,
            title=existing_db_session.title,
            message="会话连接成功",
        )

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"会话连接失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"会话连接失败: {str(e)}",
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

    # 从内存活跃会话存储中移除
    active_session_store.discard(session_id)

    # 停止对应的scrcpy服务
    try:
        await scrcpy_service_manager.stop_connect_device(session_id)
        logging.info(f"已停止scrcpy服务会话: {session_id}")
    except Exception as e:
        logging.warning(f"停止scrcpy服务时出错: {e}")

    return {"message": "会话已删除"}


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


@router.get("/screencap")
async def screencap_endpoint(
    session_id: str = Query(..., description="会话ID"),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """获取设备实时截屏（adb screencap）"""
    db_session = (
        db.query(DBSession)
        .filter(DBSession.id == session_id, DBSession.user_id == current_user.id)
        .first()
    )
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="会话不存在"
        )
    if not db_session.device_ip or not db_session.device_port:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="会话未配置设备信息"
        )

    device_ip = db_session.device_ip
    device_port = int(db_session.device_port) if db_session.device_port else 5555

    png_data = await screencap_async(device_ip, device_port)
    if png_data is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"无法获取设备 {device_ip}:{device_port} 截屏，请检查ADB连接",
        )

    return StreamingResponse(
        iter([png_data]),
        media_type="image/png",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
