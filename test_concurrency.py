import asyncio
import time
import logging
from infra.scrcpy_service_manager import scrcpy_service_manager

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

async def test_concurrent_operations():
    """测试并发操作"""
    logging.info("开始并发操作测试")
    
    # 模拟设备IP和端口
    device_ip = "127.0.0.1"
    device_port = 5555
    
    # 创建多个服务实例
    session_ids = [f"test_session_{i}" for i in range(3)]
    
    # 测试并发创建服务
    start_time = time.time()
    tasks = []
    for session_id in session_ids:
        task = asyncio.create_task(
            scrcpy_service_manager.create_service(session_id, device_ip, device_port)
        )
        tasks.append(task)
    
    try:
        # 等待所有创建任务完成，设置超时
        results = await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=30)
        elapsed_time = time.time() - start_time
        logging.info(f"并发创建服务完成，耗时: {elapsed_time:.2f} 秒")
        
        # 打印结果
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logging.warning(f"创建服务 {session_ids[i]} 失败: {result}")
            else:
                logging.info(f"创建服务 {session_ids[i]} 成功，端口: {result}")
        
        # 测试并发获取服务状态
        start_time = time.time()
        status_tasks = []
        for session_id in session_ids:
            task = asyncio.create_task(
                scrcpy_service_manager.get_service_status(session_id)
            )
            status_tasks.append(task)
        
        status_results = await asyncio.gather(*status_tasks, return_exceptions=True)
        elapsed_time = time.time() - start_time
        logging.info(f"并发获取服务状态完成，耗时: {elapsed_time:.2f} 秒")
        
        # 打印状态结果
        for i, result in enumerate(status_results):
            if isinstance(result, Exception):
                logging.warning(f"获取服务 {session_ids[i]} 状态失败: {result}")
            else:
                logging.info(f"服务 {session_ids[i]} 状态: {result}")
                
    except asyncio.TimeoutError:
        logging.error("并发操作超时")
    finally:
        # 清理所有服务
        cleanup_tasks = []
        for session_id in session_ids:
            task = asyncio.create_task(
                scrcpy_service_manager.stop_service(session_id)
            )
            cleanup_tasks.append(task)
        
        if cleanup_tasks:
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)
            logging.info("已清理所有测试服务")

async def main():
    """主测试函数"""
    logging.info("开始测试优化后的代码并发性能")
    
    # 运行并发操作测试
    await test_concurrent_operations()
    
    logging.info("测试完成")

if __name__ == "__main__":
    asyncio.run(main())
