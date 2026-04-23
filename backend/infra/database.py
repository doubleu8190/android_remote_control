"""
SQLite数据库模块
"""

import os
from sqlalchemy import (
    create_engine,
    Column,  # noqa: F401
    String,  # noqa: F401
    Boolean,  # noqa: F401
    DateTime,  # noqa: F401
    Text,  # noqa: F401
    ForeignKey,  # noqa: F401
    JSON,  # noqa: F401
)
from sqlalchemy.ext.declarative import declarative_base  # noqa: F401
from sqlalchemy.orm import sessionmaker, Session, relationship  # noqa: F401
from sqlalchemy.sql import func  # noqa: F401
from datetime import datetime
from typing import Generator, Optional  # noqa: F401
import uuid
from passlib.context import CryptContext
# SQLAlchemy基础类（从共享模块导入）
from .db_base import Base

# 密码哈希上下文（与auth.py保持一致）
# deprecated="auto": 自动处理过时的哈希算法，验证时接受旧哈希但生成新哈希时使用最新算法
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# SQLite数据库文件路径
SQLITE_DB_PATH = os.environ.get(
    "SQLITE_DB_PATH",
    os.path.join(
        os.path.dirname(__file__),
        "../data/ai_agent.db"))

# 创建数据库目录（如果不存在）
os.makedirs(os.path.dirname(SQLITE_DB_PATH), exist_ok=True)


# 数据库连接URL
DATABASE_URL = f"sqlite:///{SQLITE_DB_PATH}"

# 创建数据库引擎
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite需要这个参数
    echo=False,  # 设置为True可查看SQL语句
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    获取数据库会话
    在依赖注入中使用
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    初始化数据库
    创建所有表并插入默认数据
    """
    # 导入模型以确保它们注册到Base.metadata
    from backend.model import models_db  # noqa: F401

    # 创建所有表
    Base.metadata.create_all(bind=engine)

    # 创建默认管理员用户
    db = SessionLocal()
    try:
        # 检查是否已存在管理员用户
        from backend.model.models_db import User  # 避免循环导入

        existing_admin = db.query(User).filter(User.username == "root").first()
        if not existing_admin:
            # 创建管理员用户
            hashed_password = pwd_context.hash("123456")
            admin_user = User(
                id=str(uuid.uuid4()),
                username="root",
                email="admin@example.com",
                full_name="系统管理员",
                hashed_password=hashed_password,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db.add(admin_user)
            db.commit()
            print("✅ 默认管理员用户已创建: root / 123456")
        else:
            print("ℹ️  管理员用户已存在")
    except Exception as e:
        db.rollback()
        print(f"❌ 初始化数据库时出错: {e}")
        raise
    finally:
        db.close()
