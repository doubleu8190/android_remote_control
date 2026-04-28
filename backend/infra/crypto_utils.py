"""
API密钥对称加密/解密工具
使用 Fernet 对称加密，确保存储的 API key 可还原用于 LLM 调用
"""

import os
import base64
import hashlib
import logging
from cryptography.fernet import Fernet


def _get_encryption_key() -> bytes:
    """获取加密密钥，优先使用环境变量，否则从 JWT_SECRET_KEY 派生"""
    key = os.getenv("API_KEY_ENCRYPTION_KEY")
    if key:
        try:
            # 直接作为 base64 编码的 Fernet key
            base64.urlsafe_b64decode(key)
            return key.encode()
        except Exception:
            logging.warning("API_KEY_ENCRYPTION_KEY 格式无效，将从 JWT_SECRET_KEY 派生")

    # 从 JWT_SECRET_KEY 派生
    fallback = os.getenv("JWT_SECRET_KEY", "your-secret-key-here-change-in-production")
    derived = base64.urlsafe_b64encode(hashlib.sha256(fallback.encode()).digest())
    return derived


_cipher = Fernet(_get_encryption_key())


def encrypt_api_key(api_key: str) -> str:
    """加密 API key"""
    if not api_key:
        return api_key
    return _cipher.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """解密 API key"""
    if not encrypted_key:
        return encrypted_key
    try:
        return _cipher.decrypt(encrypted_key.encode()).decode()
    except Exception as e:
        logging.error(f"API key 解密失败: {e}")
        raise
