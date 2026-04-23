#!/usr/bin/env python3
"""
测试会话管理稳定性的脚本
模拟快速连续创建会话和页面刷新场景
"""

import asyncio
import aiohttp
import uuid
import time

API_BASE_URL = "http://localhost:8080/api"
USERNAME = "root"
PASSWORD = "123456"

class SessionStabilityTest:
    def __init__(self):
        self.base_url = API_BASE_URL
        self.token = None
        self.session_count = 0
        self.created_sessions = []
    
    async def login(self):
        """登录获取认证令牌"""
        async with aiohttp.ClientSession() as session:
            data = {
                'username': USERNAME,
                'password': PASSWORD
            }
            
            async with session.post(f"{self.base_url}/auth/login", data=data) as response:
                if response.status == 200:
                    result = await response.json()
                    self.token = result['access_token']
                    print(f"登录成功，获取到令牌: {self.token[:20]}...")
                    return True
                else:
                    print(f"登录失败: {response.status}")
                    return False
    
    async def create_session(self, session_idx):
        """创建会话"""
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {self.token}',
                'Content-Type': 'application/json'
            }
            
            # 生成唯一时间戳
            timestamp = int(time.time() * 1000)  # 毫秒级时间戳
            data = {
                'title': f'Test Session {session_idx} - {timestamp}',
                'metadata': {
                    'test': 'true',
                    'timestamp': timestamp  # 添加时间戳防止重复
                }
            }
            
            start_time = time.time()
            async with session.post(f"{self.base_url}/sessions/", headers=headers, json=data) as response:
                end_time = time.time()
                
                if response.status == 200:
                    result = await response.json()
                    session_id = result['id']
                    self.created_sessions.append(session_id)
                    self.session_count += 1
                    print(f"创建会话 {session_idx} 成功: {session_id} (耗时: {end_time - start_time:.3f}s)")
                    return session_id
                else:
                    print(f"创建会话 {session_idx} 失败: {response.status}")
                    return None
    
    async def get_sessions(self):
        """获取会话列表"""
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {self.token}'
            }
            
            async with session.get(f"{self.base_url}/sessions/", headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"获取到 {len(result)} 个会话")
                    return result
                else:
                    print(f"获取会话列表失败: {response.status}")
                    return []
    
    async def test_concurrent_creation(self, count=5):
        """测试并发创建会话"""
        print(f"\n=== 测试并发创建 {count} 个会话 ===")
        
        # 清理所有会话
        await self.cleanup_all_sessions()
        
        # 清理之前的测试会话
        self.created_sessions = []
        self.session_count = 0
        
        # 并发创建会话
        tasks = []
        for i in range(count):
            task = asyncio.create_task(self.create_session(i + 1))
            tasks.append(task)
        
        await asyncio.gather(*tasks)
        
        print(f"\n并发测试完成: 成功创建 {self.session_count} 个会话")
        
        # 验证会话数量
        sessions = await self.get_sessions()
        actual_count = len(sessions)
        print(f"实际会话数量: {actual_count}")
        
        if actual_count == self.session_count:
            print("✅ 会话数量正确")
        else:
            print(f"❌ 会话数量不一致: 期望 {self.session_count}, 实际 {actual_count}")
    
    async def test_rapid_creation(self, count=10):
        """测试快速连续创建会话"""
        print(f"\n=== 测试快速连续创建 {count} 个会话 ===")
        
        # 清理所有会话
        await self.cleanup_all_sessions()
        
        # 清理之前的测试会话
        self.created_sessions = []
        self.session_count = 0
        
        # 快速连续创建会话
        for i in range(count):
            await self.create_session(i + 1)
            # 模拟用户快速点击，添加微小延迟
            await asyncio.sleep(0.1)
        
        print(f"\n快速连续测试完成: 成功创建 {self.session_count} 个会话")
        
        # 验证会话数量
        sessions = await self.get_sessions()
        actual_count = len(sessions)
        print(f"实际会话数量: {actual_count}")
        
        if actual_count == self.session_count:
            print("✅ 会话数量正确")
        else:
            print(f"❌ 会话数量不一致: 期望 {self.session_count}, 实际 {actual_count}")
    
    async def test_session_persistence(self):
        """测试会话持久化（模拟页面刷新）"""
        print("\n=== 测试会话持久化 ===")
        
        # 清理所有会话
        await self.cleanup_all_sessions()
        
        # 清理之前的测试会话
        self.created_sessions = []
        self.session_count = 0
        
        # 创建一个测试会话
        test_session = await self.create_session(999)
        if not test_session:
            print("❌ 创建测试会话失败")
            return
        
        print(f"创建测试会话: {test_session}")
        
        # 模拟页面刷新，重新获取会话列表
        sessions = await self.get_sessions()
        session_ids = [s['id'] for s in sessions]
        
        if test_session in session_ids:
            print("✅ 会话在页面刷新后仍然存在")
        else:
            print("❌ 会话在页面刷新后丢失")
    
    async def cleanup_all_sessions(self):
        """清理所有会话"""
        print("\n=== 清理所有会话 ===")
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {self.token}'
            }
            
            # 获取所有会话
            async with session.get(f"{self.base_url}/sessions/", headers=headers) as response:
                if response.status == 200:
                    sessions = await response.json()
                    
                    for session_data in sessions:
                        session_id = session_data['id']
                        async with session.delete(f"{self.base_url}/sessions/{session_id}", headers=headers) as delete_response:
                            if delete_response.status == 200:
                                print(f"删除会话 {session_id} 成功")
                            else:
                                print(f"删除会话 {session_id} 失败: {delete_response.status}")
                else:
                    print(f"获取会话列表失败: {response.status}")

    async def cleanup(self):
        """清理测试会话"""
        print("\n=== 清理测试会话 ===")
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {self.token}'
            }
            
            for session_id in self.created_sessions:
                async with session.delete(f"{self.base_url}/sessions/{session_id}", headers=headers) as response:
                    if response.status == 200:
                        print(f"删除会话 {session_id} 成功")
                    else:
                        print(f"删除会话 {session_id} 失败: {response.status}")

async def main():
    test = SessionStabilityTest()
    
    # 登录
    if not await test.login():
        return
    
    try:
        # 测试并发创建
        await test.test_concurrent_creation(5)
        
        # 测试快速连续创建
        await test.test_rapid_creation(10)
        
        # 测试会话持久化
        await test.test_session_persistence()
    finally:
        # 清理
        await test.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
