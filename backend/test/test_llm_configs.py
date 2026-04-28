import pytest
from fastapi.testclient import TestClient
from backend.api.main import app
from backend.infra.database import get_db, init_db
from sqlalchemy.orm import Session
from backend.model.models_db import User, LLMConfig
import uuid
from backend.api.auth import get_password_hash
from backend.infra.crypto_utils import encrypt_api_key

client = TestClient(app)


@pytest.fixture
def db():
    """获取数据库会话"""
    from backend.infra.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user(db: Session):
    """创建测试用户"""
    # 先检查是否已存在testuser用户，如果存在则删除
    existing_user = db.query(User).filter(User.username == "testuser").first()
    if existing_user:
        db.delete(existing_user)
        db.commit()
    
    hashed_password = get_password_hash("test123456")
    user = User(
        id=str(uuid.uuid4()),
        username="testuser",
        email="test@example.com",
        full_name="Test User",
        hashed_password=hashed_password,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_token(test_user):
    """获取测试用户的访问令牌"""
    response = client.post(
        "/api/auth/login",
        data={"username": "testuser", "password": "test123456"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def test_llm_config(db: Session, test_user):
    """创建测试LLM配置"""
    encrypted_api_key = encrypt_api_key("test-api-key-123456")
    config = LLMConfig(
        id=str(uuid.uuid4()),
        user_id=test_user.id,
        api_key=encrypted_api_key,
        base_url="https://api.openai.com/v1",
        model="gpt-3.5-turbo",
        temperature=0.7,
        is_active=True
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def test_create_llm_config(test_token):
    """测试创建LLM配置"""
    response = client.post(
        "/api/llm-configs",
        headers={"Authorization": f"Bearer {test_token}"},
        json={
            "api_key": "test-api-key-123456",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-3.5-turbo",
            "temperature": 0.7
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["base_url"] == "https://api.openai.com/v1"
    assert data["model"] == "gpt-3.5-turbo"
    assert data["temperature"] == 0.7
    assert data["is_active"] is True


def test_get_llm_configs(test_token, test_llm_config):
    """测试获取LLM配置列表"""
    response = client.get(
        "/api/llm-configs",
        headers={"Authorization": f"Bearer {test_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == test_llm_config.id


def test_get_llm_config(test_token, test_llm_config):
    """测试获取单个LLM配置"""
    response = client.get(
        f"/api/llm-configs/{test_llm_config.id}",
        headers={"Authorization": f"Bearer {test_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_llm_config.id
    assert data["base_url"] == test_llm_config.base_url
    assert data["model"] == test_llm_config.model


def test_update_llm_config(test_token, test_llm_config):
    """测试更新LLM配置"""
    response = client.put(
        f"/api/llm-configs/{test_llm_config.id}",
        headers={"Authorization": f"Bearer {test_token}"},
        json={
            "temperature": 0.5,
            "is_active": False
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_llm_config.id
    assert data["temperature"] == 0.5
    assert data["is_active"] is False


def test_delete_llm_config(test_token, test_llm_config):
    """测试删除LLM配置"""
    response = client.delete(
        f"/api/llm-configs/{test_llm_config.id}",
        headers={"Authorization": f"Bearer {test_token}"}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "LLM配置删除成功"
    
    # 验证配置已删除
    response = client.get(
        f"/api/llm-configs/{test_llm_config.id}",
        headers={"Authorization": f"Bearer {test_token}"}
    )
    assert response.status_code == 404


def test_create_llm_config_invalid_data(test_token):
    """测试创建LLM配置时提供无效数据"""
    # 测试无效的temperature值
    response = client.post(
        "/api/llm-configs",
        headers={"Authorization": f"Bearer {test_token}"},
        json={
            "api_key": "test-api-key-123456",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-3.5-turbo",
            "temperature": 2.0  # 超出范围
        }
    )
    assert response.status_code == 422

    # 测试无效的base_url
    response = client.post(
        "/api/llm-configs",
        headers={"Authorization": f"Bearer {test_token}"},
        json={
            "api_key": "test-api-key-123456",
            "base_url": "invalid-url",  # 无效的URL
            "model": "gpt-3.5-turbo",
            "temperature": 0.7
        }
    )
    assert response.status_code == 422


def test_unauthorized_access():
    """测试未授权访问"""
    response = client.get("/api/llm-configs")
    assert response.status_code == 401

    response = client.post("/api/llm-configs", json={})
    assert response.status_code == 401

    response = client.put("/api/llm-configs/test-id", json={})
    assert response.status_code == 401

    response = client.delete("/api/llm-configs/test-id")
    assert response.status_code == 401
