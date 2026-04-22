import asyncio
import logging
import json
import websockets
from typing import Optional, Dict, Any, Set
from dataclasses import asdict
from .scrcpy_service import ScrcpyService
from model.models_ws import (
    WebSocketRequest,
    WebSocketResponse,
    WebSocketRequestType,
    ConnectDeviceMessage,
)


class Channel:
    """视频通道"""

    def __init__(self, device_ip: str, device_port: int):
        self.device_ip = device_ip
        self.device_port = device_port
        self.channel_id = None  # 视频通道ID，初始为None

    def __str__(self):
        return f"Channel {self.device_ip}:{self.device_port}"


class ScrcpyServiceManager:
    """scrcpy服务管理器"""

    def __init__(self):
        self.lock = asyncio.Lock()
        self.ws_server: Optional[websockets.Server] = None
        # 客户端到发送锁的映射：websocket -> asyncio.Lock
        self.send_locks: Dict[Any, asyncio.Lock] = {}
        # 视频通道存储：使用(ip, port)作为键，值为客户端ws实例
        self.channel_to_clients: Dict[Channel, Set[Any]] = {}
        # 客户端到视频通道的映射：websocket -> Channel
        self.client_to_channel: Dict[Any, Channel] = {}
        # 视频通道到scrcpy服务的映射：Channel -> ScrcpyService
        self.channel_to_scrcpy: Dict[Channel, ScrcpyService] = {}
        # 会话到客户端的映射：session_id -> websocket
        self.session_to_clients: Dict[str, Any] = {}
        # 客户端到会话的映射：websocket -> session_id，用于客户端异常关闭连接时，清理session_to_clients
        self.client_to_session: Dict[Any, str] = {}

    async def cancelChannel(self, channel: Channel):
        """
        取消指定视频通道的订阅, 并关闭服务实例
        """
        scrcpy_service = self.channel_to_scrcpy.pop(channel, None)
        if scrcpy_service is not None and scrcpy_service.is_running():
            scrcpy_service.stop()

        clients = self.channel_to_clients.get(channel, None)
        if clients is not None:
            for websocket in clients:
                await websocket.close(code=1000, reason="取消客户端订阅")
                self.client_to_channel.pop(websocket)
                session_id = self.client_to_session.pop(websocket, None)
                self.session_to_clients.pop(session_id, None)
            self.channel_to_clients.clear(channel)

    async def unsubscribe_channel(self, websocket: Any):
        """
        取消客户端订阅视频通道的权限, 并关闭连接
        :param websocket: 客户端websocket实例
        """
        with self.lock:
            # 移除客户端到视频通道的映射
            channel = self.client_to_channel.pop(websocket, None)
            if channel is not None:
                # 移除视频通道到客户端的映射
                clients = self.channel_to_clients.get(channel)
                if clients is not None:
                    clients.remove(websocket)
                    self.channel_to_clients[channel] = clients
                if len(clients) == 0:
                    scrcpy_service = self.channel_to_scrcpy.pop(channel, None)
                    if scrcpy_service is not None:
                        scrcpy_service.stop()
            self.send_locks.pop(websocket, None)
            session_id = self.client_to_session.pop(websocket, None)
            self.session_to_clients.pop(session_id, None)
            await websocket.close(code=1000, reason="取消客户端订阅")
            logging.info(f"已取消客户端{websocket}订阅视频通道: {channel}")

    async def subscribe_channel(self, websocket: Any, device_ip: str, device_port: int):
        """
        订阅视频通道, 必要时创建服务实例
        :param websocket: 客户端websocket实例
        :param device_ip: 设备IP地址
        :param device_port: 设备端口号
        """
        channel = Channel(device_ip, device_port)
        with self.lock:
            service = self.channel_to_scrcpy.get(channel)
            if service is None:
                # 新的视频通道，创建服务实例, 并存储服务实例
                service = await self.create_scrcpy_service(device_ip, device_port)
                if service is None:
                    return
                self.channel_to_scrcpy[channel] = service

            # 存储视频通道到客户端的映射
            clients = self.channel_to_clients.get(channel)
            if clients is None:
                clients = set()
            clients.add(websocket)
            self.channels[channel] = clients

            # 存储客户端到视频通道的映射
            self.client_to_channel[websocket] = channel

        logging.info(
            f"{websocket} 成功订阅视频通道 {channel} ，当前订阅数: {len(clients)}"
        )

    async def handle_connect_device(self, websocket, json_message: str):
        """
        处理连接设备请求, 并订阅视频通道
        :param websocket: 客户端websocket实例
        :param json_message: 客户端发送的JSON消息
        """
        try:
            message_dict = json.loads(json_message)
            message = ConnectDeviceMessage(**message_dict)
        except Exception as e:
            logging.error(f"解析连接设备请求失败: {e}")
            return

        logging.info(f"收到连接设备请求: {message}")
        try:
            # 检查会话是否已存在
            if message.session_id in self.session_to_clients:
                await websocket.close(code=1000, reason="会话已存在，无法重复连接")
                return
            await self.subscribe_channel(
                websocket, message.device_ip, message.device_port
            )
            # 存储会话到客户端的映射
            self.session_to_clients[message.session_id] = websocket

            # 存储客户端到会话的映射
            self.client_to_session[websocket] = message.session_id

        except Exception as e:
            logging.error(f"创建设备服务失败: {e}")
            response = WebSocketResponse(
                status=False,
                response=f"{message.session_id} {message.device_ip}:{message.device_port}连接失败:{e}",
            )
            await websocket.send(
                json.dumps(asdict(response)), ensure_ascii=False, indent=2
            )
            await self.unsubscribe_channel(websocket)

        try:
            response = WebSocketResponse(
                status=True,
                response=f"{message.session_id} {message.device_ip}:{message.device_port}连接成功，开始传输视频流",
            )
            await websocket.send(
                json.dumps(asdict(response), ensure_ascii=False, indent=2)
            )
        except Exception as e:
            logging.error(f"发送连接成功响应失败: {e}")
            await self.unsubscribe_channel(websocket)

    async def start(self):
        # 启动WebSocket服务器
        try:
            self.ws_server = await websockets.serve(
                self.handle_client,
                "0.0.0.0",
                8190,
            )
            logging.info("WebSocket服务器启动，监听端口: 8190")
        except Exception as ws_error:
            logging.error(f"启动WebSocket服务器失败: {ws_error}")
            raise RuntimeError(f"启动WebSocket服务器失败: {ws_error}")

    async def video_loop(
        self, scrcpy_service: ScrcpyService, ffmpeg_reader: asyncio.StreamReader
    ):
        """
        从 ffmpeg 输出管道 读取 MJPEG 字节流，按 JPEG 起止标记拆帧后广播。

        关键点：
        - 不能用 BufferedReader.read(4096) 这种“读满才返回”的 API，否则在数据不足时会表现为卡死；
        - asyncio 子进程的 StreamReader.read(n) 会在“有数据可读”时尽快返回(<=n), 不会强制等满 n 字节；
        """

        buf = bytearray()
        max_buf = 8 * 1024 * 1024

        try:
            logging.info("开始视频读取循环")
            while self.is_running():
                logging.debug("等待ffmpeg stdout 读取数据...")
                # 增加超时机制，避免无限阻塞
                try:
                    chunk = await asyncio.wait_for(
                        ffmpeg_reader.read(4096), timeout=10.0
                    )
                except asyncio.TimeoutError:
                    logging.warning("ffmpeg stdout 读取超时，检查ffmpeg进程状态")
                    # 检查ffmpeg进程是否还在运行
                    if not scrcpy_service.is_running():
                        logging.warning("scrcpy_service已退出")
                        await self.cancelChannel(
                            Channel(
                                scrcpy_service.device_ip, scrcpy_service.device_port
                            )
                        )
                        break
                    continue
                if not chunk:
                    logging.debug("ffmpeg stdout 读取到空数据，结束读取")
                    break
                logging.debug(f"ffmpeg stdout 读取 {len(chunk)} 字节")
                buf.extend(chunk)
                if len(buf) > max_buf:
                    logging.debug(f"视频缓冲区大小超过 {max_buf} 字节，开始丢弃旧数据")
                    # 丢弃旧数据，尝试从最近的 JPEG 头开始重新同步
                    start = buf.rfind(b"\xff\xd8")
                    if start == -1:
                        buf.clear()
                    else:
                        del buf[:start]

                while True:
                    start = buf.find(b"\xff\xd8")  # SOI
                    if start == -1:
                        # 保留末尾 1 字节，避免 SOI 被跨 chunk 拆开
                        if len(buf) > 1:
                            del buf[:-1]
                        break
                    end = buf.find(b"\xff\xd9", start + 2)  # EOI
                    if end == -1:
                        if start > 0:
                            del buf[:start]
                        break

                    frame = bytes(buf[start : end + 2])
                    del buf[: end + 2]
                    await self.broadcast(
                        Channel(scrcpy_service.device_ip, scrcpy_service.device_port),
                        frame,
                    )
        except asyncio.CancelledError:
            logging.info("视频读取线程被取消")
            raise
        except Exception as e:
            logging.error(f"视频读取/广播循环异常: {e}")
            raise

    async def broadcast(self, channel: Channel, payload: bytes):
        """
        向所有客户端发送二进制数据；失败的客户端会被剔除，避免拖垮视频读取线程
            :param channel: 目标频道
            :param payload: 要发送的二进制数据
        """
        clients = self.channel_to_clients.get(channel, set())
        if not clients:
            logging.warning(f"频道 {channel} 无客户端连接")
            return

        logging.debug(f"广播 {len(payload)} 字节数据到频道 {channel}")

        async def _safe_send(ws) -> bool:
            try:
                lock = self.send_locks.get(ws)
                if lock is None:
                    lock = asyncio.Lock()
                    self.send_locks[ws] = lock
                async with lock:
                    await asyncio.wait_for(ws.send(payload), timeout=0.5)
                return True
            except Exception as e:
                logging.error(f"_safe_send 异常: {e}")
                return False

        results = await asyncio.gather(
            *(_safe_send(ws) for ws in list(clients)), return_exceptions=True
        )
        # 清理发送失败的连接
        for ws, ok in zip(list(clients), results):
            if ok is not True:
                try:
                    await self.unsubscribe_channel(ws)
                except Exception as e:
                    logging.error(f"关闭客户端 {id(ws)} 连接时出错: {e}")

    async def handle_client(self, websocket):
        """处理WebSocket客户端连接"""
        self.send_locks.setdefault(websocket, asyncio.Lock())
        message_type_handlers = {
            WebSocketRequestType.CONNECT_DEVICE: self.handle_connect_device
        }
        try:
            async for message in websocket:
                if isinstance(message, (bytes, bytearray)):
                    logging.warning(
                        f"收到客户端发来的二进制消息，大小: {len(message)} 字节，跳过处理"
                    )
                    continue
                try:
                    obj = json.loads(message)
                    request = WebSocketRequest(**obj)
                    handler = message_type_handlers[request.type]
                    await handler(websocket, request.data)
                except Exception as e:
                    logging.error(f"客户端发送非法消息: {message}，解析异常: {e}")
                    await websocket.close(
                        code=1000,
                        reason=f"客户端发送非法消息: {message}，解析异常: {e}",
                    )
                    await self.unsubscribe_channel(websocket)

        except Exception as e:
            logging.error(f"处理客户端连接异常: {e}")
            await websocket.close(code=1000, reason=f"处理客户端连接异常: {e}")
            await self.unsubscribe_channel(websocket)

    async def create_scrcpy_service(
        self, device_ip: str, device_port: int
    ) -> ScrcpyService:
        """创建并启动scrcpy服务"""
        service = ScrcpyService(device_ip, device_port)
        try:
            out_fifo = await service.start()
            asyncio.create_task(self.video_loop(service, out_fifo))
        except Exception as e:
            logging.error(f"启动scrcpy服务时发生异常: {e}")
            service.stop()
        return None

    async def stop_service(self):
        """停止指定会话的scrcpy服务"""
        with self.lock:
            for client in self.client_to_channel.keys():
                await client.close(code=1000, reason="服务准备停止")

            for service in self.channel_to_service.values():
                await service.stop()

    async def stop_connect_device(self, session_id: str):
        """
        停止指定设备的scrcpy服务
        """
        client = self.session_to_clients.get(session_id, None)
        self.unsubscribe_channel(client)


# 全局服务管理器实例
scrcpy_service_manager = ScrcpyServiceManager()
