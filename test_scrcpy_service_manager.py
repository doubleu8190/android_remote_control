import asyncio
from infra.scrcpy_service_manager import scrcpy_service_manager

async def test_scrcpy_service_manager():
    # 测试创建服务
    print("测试创建服务...")
    ws_port = await scrcpy_service_manager.create_service(
        session_id="test_session_1",
        device_ip="192.168.31.113",
        device_port=36409
    )
    print(f"创建服务成功，WebSocket端口: {ws_port}")
    
    # 测试列出服务
    print("测试列出服务...")
    services = await scrcpy_service_manager.list_services()
    print(f"当前运行中的服务: {services}")
    
    # 测试停止服务
    print("测试停止服务...")
    await scrcpy_service_manager.stop_service("test_session_1")
    print("停止服务成功")
    
    # 测试列出服务
    print("测试列出服务...")
    services = await scrcpy_service_manager.list_services()
    print(f"当前运行中的服务: {services}")

if __name__ == "__main__":
    asyncio.run(test_scrcpy_service_manager())
