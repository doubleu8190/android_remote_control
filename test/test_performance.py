import asyncio
import websockets
import time
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

async def test_client(ws_url, client_id):
    """测试WebSocket客户端连接"""
    try:
        logging.info(f"客户端 {client_id} 尝试连接到 {ws_url}")
        async with websockets.connect(ws_url) as ws:
            logging.info(f"客户端 {client_id} 连接成功")
            start_time = time.time()
            message_count = 0
            
            # 接收消息，测试连接稳定性
            while time.time() - start_time < 30:  # 测试30秒
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    message_count += 1
                    if message_count % 100 == 0:
                        logging.info(f"客户端 {client_id} 已接收 {message_count} 条消息")
                except asyncio.TimeoutError:
                    logging.warning(f"客户端 {client_id} 接收消息超时")
                    break
                except websockets.exceptions.ConnectionClosed:
                    logging.info(f"客户端 {client_id} 连接已关闭")
                    break
            
            elapsed_time = time.time() - start_time
            logging.info(f"客户端 {client_id} 测试完成，接收 {message_count} 条消息，耗时 {elapsed_time:.2f} 秒")
            return message_count, elapsed_time
    except Exception as e:
        logging.error(f"客户端 {client_id} 测试失败: {e}")
        return 0, 0

async def main():
    """主测试函数"""
    # 替换为实际的WebSocket URL
    ws_url = "ws://localhost:8212"
    client_count = 5  # 测试5个客户端
    
    logging.info(f"开始性能测试，测试 {client_count} 个客户端连接")
    
    # 创建多个客户端任务
    tasks = []
    for i in range(client_count):
        task = asyncio.create_task(test_client(ws_url, i + 1))
        tasks.append(task)
        # 稍微延迟，避免同时连接导致的压力
        await asyncio.sleep(0.5)
    
    # 等待所有测试完成
    results = await asyncio.gather(*tasks)
    
    # 计算统计数据
    total_messages = sum(msg_count for msg_count, _ in results)
    total_time = sum(elapsed for _, elapsed in results)
    avg_messages = total_messages / client_count if client_count > 0 else 0
    avg_time = total_time / client_count if client_count > 0 else 0
    
    logging.info(f"性能测试完成")
    logging.info(f"总客户端数: {client_count}")
    logging.info(f"总消息数: {total_messages}")
    logging.info(f"平均消息数: {avg_messages:.2f}")
    logging.info(f"平均耗时: {avg_time:.2f} 秒")

if __name__ == "__main__":
    asyncio.run(main())
