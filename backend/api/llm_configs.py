from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.model.models_api import (
    LLMConfigCreate, LLMConfigUpdate, LLMConfigResponse
)
from backend.infra.database import get_db
from backend.model.models_db import LLMConfig, User
from backend.api.auth import get_current_active_user, get_password_hash
import logging

router = APIRouter(prefix="/api/llm-configs", tags=["llm-configs"])


@router.post("", response_model=LLMConfigResponse)
async def create_llm_config(
    config_data: LLMConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """创建LLM配置"""
    # 加密API密钥
    hashed_api_key = get_password_hash(config_data.api_key)
    
    # 创建新配置
    db_config = LLMConfig(
        user_id=current_user.id,
        api_key=hashed_api_key,
        base_url=config_data.base_url,
        model=config_data.model,
        temperature=config_data.temperature,
        is_active=True
    )
    logging.info(f"创建LLM配置, 用户ID: {current_user.id}, 模型: {config_data}")
    
    try:
        db.add(db_config)
        db.commit()
        db.refresh(db_config)
        
        # 转换为响应模型
        return LLMConfigResponse(
            id=db_config.id,
            user_id=db_config.user_id,
            base_url=db_config.base_url,
            model=db_config.model,
            temperature=db_config.temperature,
            is_active=db_config.is_active,
            created_at=db_config.created_at,
            updated_at=db_config.updated_at
        )
    except Exception as e:
        db.rollback()
        logging.error(f"创建LLM配置失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建LLM配置失败"
        )


@router.get("", response_model=List[LLMConfigResponse])
async def get_llm_configs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取当前用户的LLM配置列表"""
    configs = db.query(LLMConfig).filter(
        LLMConfig.user_id == current_user.id
    ).offset(skip).limit(limit).all()
    logging.info(f"获取LLM配置列表, 用户ID: {current_user.id}, 配置数量: {len(configs)}")
    # 转换为响应模型列表
    return [
        LLMConfigResponse(
            id=config.id,
            user_id=config.user_id,
            base_url=config.base_url,
            model=config.model,
            temperature=config.temperature,
            is_active=config.is_active,
            created_at=config.created_at,
            updated_at=config.updated_at
        )
        for config in configs
    ]


@router.get("/{config_id}", response_model=LLMConfigResponse)
async def get_llm_config(
    config_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取单个LLM配置"""
    config = db.query(LLMConfig).filter(
        LLMConfig.id == config_id,
        LLMConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="LLM配置不存在"
        )
    
    # 转换为响应模型
    return LLMConfigResponse(
        id=config.id,
        user_id=config.user_id,
        base_url=config.base_url,
        model=config.model,
        temperature=config.temperature,
        is_active=config.is_active,
        created_at=config.created_at,
        updated_at=config.updated_at
    )


@router.put("/{config_id}", response_model=LLMConfigResponse)
async def update_llm_config(
    config_id: str,
    config_data: LLMConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """更新LLM配置"""
    config = db.query(LLMConfig).filter(
        LLMConfig.id == config_id,
        LLMConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="LLM配置不存在"
        )
    
    # 更新字段
    update_data = config_data.model_dump(exclude_unset=True)
    
    # 如果更新API密钥，需要加密
    if "api_key" in update_data:
        update_data["api_key"] = get_password_hash(update_data["api_key"])
    
    try:
        for field, value in update_data.items():
            setattr(config, field, value)
        
        db.commit()
        db.refresh(config)
        
        # 转换为响应模型
        return LLMConfigResponse(
            id=config.id,
            user_id=config.user_id,
            base_url=config.base_url,
            model=config.model,
            temperature=config.temperature,
            is_active=config.is_active,
            created_at=config.created_at,
            updated_at=config.updated_at
        )
    except Exception as e:
        db.rollback()
        logging.error(f"更新LLM配置失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新LLM配置失败"
        )


@router.delete("/{config_id}")
async def delete_llm_config(
    config_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """删除LLM配置"""
    config = db.query(LLMConfig).filter(
        LLMConfig.id == config_id,
        LLMConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="LLM配置不存在"
        )
    
    try:
        db.delete(config)
        db.commit()
        return {"message": "LLM配置删除成功"}
    except Exception as e:
        db.rollback()
        logging.error(f"删除LLM配置失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除LLM配置失败"
        )
