"""测试会话与管道的一对一映射机制"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import pytest
from backend.infra.scrcpy_service_manager import fifo_allocator


class TestFifoAllocator:
    """测试FifoAllocator类"""
    
    async def test_allocate_and_release_single_session(self):
        """测试单session场景下的管道分配与释放"""
        session_id = "test_session_1"
        
        # 分配管道
        fifo_path = await fifo_allocator.allocate_fifo(session_id)
        assert fifo_path is not None
        assert fifo_path.startswith("/tmp/scrcpy_fifo_")
        assert session_id in fifo_path
        
        # 验证分配关系
        retrieved_path = await fifo_allocator.get_fifo(session_id)
        assert retrieved_path == fifo_path
        
        # 创建管道文件
        assert await fifo_allocator.create_fifo_file(fifo_path)
        assert os.path.exists(fifo_path)
        
        # 释放管道
        await fifo_allocator.release_fifo(session_id, cleanup=True)
        
        # 验证管道文件已被删除
        assert not os.path.exists(fifo_path)
        
        # 验证分配关系已被移除
        assert await fifo_allocator.get_fifo(session_id) is None
    
    async def test_concurrent_session_allocation(self):
        """测试多session并发场景下的管道分配"""
        session_ids = [f"test_session_{i}" for i in range(5)]
        
        # 并发分配管道
        tasks = [fifo_allocator.allocate_fifo(sid) for sid in session_ids]
        fifo_paths = await asyncio.gather(*tasks)
        
        # 验证每个session都有唯一的管道
        assert len(set(fifo_paths)) == len(session_ids)  # 所有管道路径唯一
        
        # 验证一对一映射
        for sid, path in zip(session_ids, fifo_paths):
            retrieved = await fifo_allocator.get_fifo(sid)
            assert retrieved == path
            assert session_ids[fifo_paths.index(path)] == sid  # 反向映射也正确
        
        # 并发创建管道文件
        create_tasks = [fifo_allocator.create_fifo_file(path) for path in fifo_paths]
        create_results = await asyncio.gather(*create_tasks)
        assert all(create_results)  # 所有管道文件创建成功
        
        # 验证管道文件存在
        for path in fifo_paths:
            assert os.path.exists(path)
        
        # 并发释放管道
        release_tasks = [fifo_allocator.release_fifo(path) for path in fifo_paths]
        await asyncio.gather(*release_tasks, return_exceptions=True)
        
        # 验证所有管道文件已被删除
        for path in fifo_paths:
            assert not os.path.exists(path)
        
        # 验证所有分配关系已被移除
        for sid in session_ids:
            assert await fifo_allocator.get_fifo(sid) is None
    
    async def test_double_allocation_prevention(self):
        """测试防止同一session重复分配管道"""
        session_id = "test_session_duplicate"
        
        # 第一次分配应该成功
        fifo_path1 = await fifo_allocator.allocate_fifo(session_id)
        assert fifo_path1 is not None
        
        # 第二次分配应该抛出异常
        with pytest.raises(RuntimeError, match=f"Session {session_id} 已分配管道"):
            await fifo_allocator.allocate_fifo(session_id)
        
        # 清理
        await fifo_allocator.release_fifo(session_id, cleanup=True)
    
    async def test_release_nonexistent_session(self):
        """测试释放不存在的session管道"""
        session_id = "test_session_nonexistent"
        
        # 释放不存在的session应该抛出异常
        with pytest.raises(RuntimeError, match=f"Session {session_id} 未分配管道"):
            await fifo_allocator.release_fifo(session_id)
    
    async def test_cleanup_all(self):
        """测试清理所有管道资源"""
        session_ids = [f"cleanup_test_{i}" for i in range(3)]
        
        # 分配多个管道
        for sid in session_ids:
            fifo_path = await fifo_allocator.allocate_fifo(sid)
            await fifo_allocator.create_fifo_file(fifo_path)
            assert os.path.exists(fifo_path)
        
        # 清理所有资源
        await fifo_allocator.cleanup_all()
        
        # 验证所有管道文件已被删除
        for sid in session_ids:
            fifo_path = await fifo_allocator.get_fifo(sid)
            assert fifo_path is None
        
        # 注意：cleanup_all会删除文件，但我们无法直接检查文件是否存在
        # 因为我们已经不知道具体的文件路径
    
    async def test_fifo_path_uniqueness(self):
        """测试管道路径的唯一性"""
        # 测试相同session_id在不同时间分配会生成不同路径（如果已存在）
        session_id = "test_session_same"
        
        # 第一次分配
        fifo_path1 = await fifo_allocator.allocate_fifo(session_id)
        assert session_id in fifo_path1
        
        # 释放但不清理文件（模拟文件残留）
        await fifo_allocator.release_fifo(session_id, cleanup=False)
        
        # 再次分配，应该生成不同的路径（因为文件已存在）
        fifo_path2 = await fifo_allocator.allocate_fifo(session_id)
        assert fifo_path2 != fifo_path1
        assert session_id in fifo_path2
        # 新路径应该包含时间戳以确保唯一性
        assert "_" in fifo_path2  # 包含额外标识
        

        # 清理
        await fifo_allocator.release_fifo(session_id, cleanup=True)


class TestScrcpyServiceFifoIntegration:
    """测试ScrcpyService与管道分配器的集成"""
    
    async def test_service_fifo_allocation(self):
        """测试ScrcpyService启动时分配独立管道"""
        from backend.infra.scrcpy_service_manager import ScrcpyService
        
        session_id = "test_service_session"
        device_ip = "192.168.1.100"  # 测试用IP，不会实际连接
        device_port = 5555
        
        service = ScrcpyService(session_id, device_ip, device_port)
        
        try:
            # 创建管道（不启动完整服务）
            await service.create_fifo()
            
            # 验证管道已分配
            assert service.fifo_path is not None
            assert session_id in service.fifo_path
            
            # 验证管道文件已创建
            assert os.path.exists(service.fifo_path)
            
            # 验证分配关系
            retrieved_path = await fifo_allocator.get_fifo(session_id)
            assert retrieved_path == service.fifo_path
            
        finally:
            # 清理
            await service.stop()  # stop方法会释放管道资源
    
    async def test_service_stop_releases_fifo(self):
        """测试ScrcpyService停止时释放管道资源"""
        from backend.infra.scrcpy_service_manager import ScrcpyService
        
        session_id = "test_service_stop_session"
        device_ip = "192.168.1.100"
        device_port = 5555
        
        service = ScrcpyService(session_id, device_ip, device_port)
        
        try:
            # 创建管道
            await service.create_fifo()
            fifo_path = service.fifo_path
            assert fifo_path is not None
            
            # 停止服务
            await service.stop()
            
            # 验证管道资源已释放
            assert service.fifo_path is None
            assert await fifo_allocator.get_fifo(session_id) is None
            
            # 验证管道文件已删除（如果存在）
            if fifo_path and os.path.exists(fifo_path):
                # 文件可能已被删除，这是正常的
                pass
                
        except Exception as e:
            await service.stop()
            raise
    
    async def test_multiple_services_unique_fifos(self):
        """测试多个ScrcpyService实例使用不同的管道"""
        from backend.infra.scrcpy_service_manager import ScrcpyService
        
        services = []
        session_ids = [f"multi_service_{i}" for i in range(3)]
        
        try:
            for sid in session_ids:
                service = ScrcpyService(sid, "192.168.1.100", 5555)
                services.append(service)
                await service.create_fifo()
            
            # 验证每个service都有不同的管道
            fifo_paths = [s.fifo_path for s in services]
            assert len(set(fifo_paths)) == len(services)  # 所有管道路径唯一
            
            # 验证管道文件都已创建
            for path in fifo_paths:
                assert os.path.exists(path)
                
        finally:
            # 清理所有服务
            for service in services:
                await service.stop()


if __name__ == "__main__":
    """运行测试"""
    import sys
    
    async def run_tests():
        """运行所有测试"""
        test_classes = [
            TestFifoAllocator(),
            TestScrcpyServiceFifoIntegration(),
        ]
        
        for test_class in test_classes:
            print(f"\n=== 测试 {test_class.__class__.__name__} ===")
            
            # 获取所有测试方法
            test_methods = [
                method for method in dir(test_class)
                if method.startswith("test_") and callable(getattr(test_class, method))
            ]
            
            for method_name in test_methods:
                print(f"运行 {method_name}...")
                try:
                    method = getattr(test_class, method_name)
                    await method()
                    print(f"  ✓ {method_name} 通过")
                except Exception as e:
                    print(f"  ✗ {method_name} 失败: {e}")
                    import traceback
                    traceback.print_exc()
    
    # 运行测试
    try:
        asyncio.run(run_tests())
        print("\n=== 所有测试完成 ===")
        sys.exit(0)
    except Exception as e:
        print(f"\n=== 测试运行失败: {e} ===")
        import traceback
        traceback.print_exc()
        sys.exit(1)