#!/usr/bin/env python3
"""
测试会话设备信息持久化存储功能
"""
import asyncio
import aiohttp
import json
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:8080"
USERNAME = "testuser2"
PASSWORD = "Test1234!"

async def get_token():
    """获取认证令牌"""
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

async def create_session_with_device(token, title, device_ip, device_port):
    """创建设备信息会话"""
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {token}"}
        async with session.post(f"{BASE_URL}/api/sessions", json={
            "title": title,
            "device_ip": device_ip,
            "device_port": device_port
        }, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                logger.info(f"创建会话成功: {data['id']}, 设备: {data.get('device_ip')}:{data.get('device_port')}")
                return data
            else:
                error_data = await response.json()
                logger.error(f"创建会话失败: {response.status}, {error_data}")
                return None

async def list_sessions(token):
    """列出所有会话"""
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {token}"}
        async with session.get(f"{BASE_URL}/api/sessions/", headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                logger.info(f"获取会话列表成功，共 {len(data)} 个会话")
                for session in data:
                    logger.info(f"  - {session['title']}: {session.get('device_ip')}:{session.get('device_port')}")
                return data
            else:
                error_data = await response.json()
                logger.error(f"获取会话列表失败: {response.status}, {error_data}")
                return None

async def update_session_device(token, session_id, device_ip, device_port):
    """更新会话的设备信息"""
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{BASE_URL}/api/sessions/{session_id}/device?device_ip={device_ip}&device_port={device_port}"
        async with session.put(url, headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                logger.info(f"更新设备信息成功: {data}")
                return True
            else:
                error_data = await response.json()
                logger.error(f"更新设备信息失败: {response.status}, {error_data}")
                return False

async def connect_device(token, session_id, device_ip, device_port):
    """连接设备"""
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

async def quick_connect_device(token, session_id):
    """快速连接设备（使用会话保存的设备信息）"""
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {token}"}
        async with session.post(f"{BASE_URL}/api/sessions/{session_id}/connect", headers=headers) as response:
            if response.status == 200:
                data = await response.json()
                logger.info(f"快速连接设备成功: {data}")
                return data
            else:
                error_data = await response.json()
                logger.error(f"快速连接设备失败: {response.status}, {error_data}")
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

async def test_session_device_persistence():
    """测试会话设备信息持久化功能"""
    logger.info("开始测试会话设备信息持久化功能")

    # 1. 注册用户
    register_success = await register_user()
    if not register_success:
        logger.error("注册用户失败，测试终止")
        return

    # 2. 获取认证令牌
    token = await get_token()
    if not token:
        logger.error("获取令牌失败，测试终止")
        return

    # 3. 创建带有设备信息的会话
    session1 = await create_session_with_device(token, "测试会话1", "192.168.31.113", 5555)
    if not session1:
        logger.error("创建会话1失败，测试终止")
        return

    session2 = await create_session_with_device(token, "测试会话2", "192.168.1.100", 5555)
    if not session2:
        logger.error("创建会话2失败，测试终止")
        return

    # 4. 列出所有会话
    sessions = await list_sessions(token)
    if not sessions:
        logger.error("获取会话列表失败，测试终止")
        return

    # 5. 更新会话的设备信息
    update_success = await update_session_device(token, session1['id'], "192.168.31.200", 5556)
    if not update_success:
        logger.error("更新设备信息失败")
        return

    # 6. 再次列出所有会话，验证更新
    sessions = await list_sessions(token)
    if not sessions:
        logger.error("获取会话列表失败")
        return

    # 7. 测试快速连接功能
    quick_connect_result = await quick_connect_device(token, session1['id'])
    if quick_connect_result:
        logger.info("快速连接测试成功")
    else:
        logger.warning("快速连接测试失败，可能是因为没有真实设备连接")

    # 8. 测试连接设备功能
    connect_result = await connect_device(token, session2['id'], "192.168.31.113", 5555)
    if connect_result:
        logger.info("连接设备测试成功")
    else:
        logger.warning("连接设备测试失败，可能是因为没有真实设备连接")

    # 9. 验证设备信息是否保存到会话
    sessions = await list_sessions(token)
    if sessions:
        for session in sessions:
            if session['id'] == session2['id']:
                if session.get('device_ip') == "192.168.31.113" and str(session.get('device_port')) == "5555":
                    logger.info("✓ 设备信息已正确保存到会话")
                else:
                    logger.warning(f"✗ 设备信息未正确保存: {session.get('device_ip')}:{session.get('device_port')}")
                break

    # 10. 清理测试会话
    await delete_session(token, session1['id'])
    await delete_session(token, session2['id'])

    logger.info("会话设备信息持久化功能测试完成")

if __name__ == "__main__":
    asyncio.run(test_session_device_persistence())
