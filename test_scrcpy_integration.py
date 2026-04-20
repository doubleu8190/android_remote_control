#!/usr/bin/env python3
"""
测试scrcpy服务的集成功能
"""
import asyncio
import aiohttp
import json
import time
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:8000"
USERNAME = "testuser"
PASSWORD = "Test1234!"

async def register_user():
    """注册用户"""
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{BASE_URL}/api/auth/register", json={
            "username": USERNAME,
            "password": PASSWORD,
            "email": f"{USERNAME}@example.com",
            "full_name": "Test User"
        }) as response:
            if response.status == 200:
                data = await response.json()
                logger.info(f"注册用户成功: {data['username']}")
                return True
            else:
                error_data = await response.json()
                # 如果用户已存在或邮箱已被注册，返回True
                detail = error_data.get("detail", "")
                if "用户名已存在" in detail or "邮箱已被注册" in detail:
                    logger.info("用户或邮箱已存在，跳过注册")
                    return True
                logger.error(f"注册用户失败: {response.status}, {error_data}")
                return False

async def get_token():
    """获取认证令牌"""
    # 先注册用户
    register_success = await register_user()
    if not register_success:
        return None
    
    async with aiohttp.ClientSession() as session:
        # 使用表单数据而不是JSON
        async with session.post(f"{BASE_URL}/api/auth/login", data={
            "username": USERNAME,
            "password": PASSWORD
        }) as response:
            if response.status == 200:
                data = await response.json()
                return data.get("access_token")
            else:
                error_data = await response.json()
                logger.error(f"登录失败: {response.status}, {error_data}")
                return None

async def create_session(token):
    """创建新会话"""
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {token}"}
        async with session.post(f"{BASE_URL}/api/sessions", json={
            "title": "测试会话"
        }, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                logger.info(f"创建会话成功: {data['id']}")
                return data['id']
            else:
                logger.error(f"创建会话失败: {response.status}")
                return None

async def connect_device(token, session_id, device_ip, device_port):
    """连接设备并启动scrcpy服务"""
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {token}"}
        async with session.post(f"{BASE_URL}/api/sessions/device/connect", json={
            "ip": device_ip,
            "port": device_port,
            "session_id": session_id
        }, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                logger.info(f"连接设备成功: {data}")
                return data
            else:
                error_data = await response.json()
                logger.error(f"连接设备失败: {response.status}, {error_data}")
                return None

async def delete_session(token, session_id):
    """删除会话"""
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {token}"}
        async with session.delete(f"{BASE_URL}/api/sessions/{session_id}", headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                logger.info(f"删除会话成功: {data}")
                return True
            else:
                error_data = await response.json()
                logger.error(f"删除会话失败: {response.status}, {error_data}")
                return False

async def test_scrcpy_service():
    """测试scrcpy服务的完整流程"""
    logger.info("开始测试scrcpy服务集成")
    
    # 1. 获取认证令牌
    token = await get_token()
    if not token:
        logger.error("获取令牌失败，测试终止")
        return
    
    # 2. 创建会话
    session_id = await create_session(token)
    if not session_id:
        logger.error("创建会话失败，测试终止")
        return
    
    # 3. 连接设备（使用模拟的设备IP和端口）
    # 注意：这里使用的是模拟设备，实际测试时需要替换为真实的设备IP和端口
    device_ip = "192.168.31.113"
    device_port = 5555
    
    logger.info(f"尝试连接设备: {device_ip}:{device_port}")
    connect_result = await connect_device(token, session_id, device_ip, device_port)
    
    if connect_result:
        logger.info("设备连接测试成功")
        # 等待几秒钟，模拟用户使用
        logger.info("等待3秒...")
        await asyncio.sleep(3)
    else:
        logger.warning("设备连接测试失败，可能是因为没有真实设备连接")
    
    # 4. 删除会话
    logger.info(f"删除会话: {session_id}")
    delete_result = await delete_session(token, session_id)
    
    if delete_result:
        logger.info("会话删除测试成功")
    else:
        logger.error("会话删除测试失败")
    
    logger.info("scrcpy服务集成测试完成")

if __name__ == "__main__":
    asyncio.run(test_scrcpy_service())
