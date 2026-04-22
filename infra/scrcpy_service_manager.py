import asyncio
import logging
import json
from typing import Optional, Dict, Any, Set
from dataclasses import asdict
from fastapi import WebSocket
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

    def __str__(self):
        return f"Channel {self.device_ip}:{self.device_port}"

    def __hash__(self):
        return hash((self.device_ip, self.device_port))

    def __eq__(self, other):
        if not isinstance(other, Channel):
            return NotImplemented
        return self.device_ip == other.device_ip and self.device_port == other.device_port


class ScrcpyServiceManager:
    """scrcpy服务管理器（单例）"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.running = False
            cls._instance.lock = asyncio.Lock()
            cls._instance.send_locks: Dict[WebSocket, asyncio.Lock] = {}
            cls._instance.channel_to_clients: Dict[Channel, Set[WebSocket]] = {}
            cls._instance.client_to_channel: Dict[WebSocket, Channel] = {}
            cls._instance.channel_to_scrcpy: Dict[Channel, ScrcpyService] = {}
            cls._instance.session_to_clients: Dict[str, WebSocket] = {}
            cls._instance.client_to_session: Dict[WebSocket, str] = {}
        return cls._instance

    async def cancel_channel(self, channel: Channel):
        """
        取消指定视频通道的订阅, 并关闭服务实例
        """
        scrcpy_service = self.channel_to_scrcpy.pop(channel, None)
        if scrcpy_service is not None and scrcpy_service.is_running():
            await scrcpy_service.stop()

        clients = self.channel_to_clients.pop(channel, None)
        if clients is not None:
            for ws in clients:
                try:
                    await ws.close(code=1000, reason="取消客户端订阅")
                except Exception as e:
                    logging.error(f"关闭客户端连接时出错: {e}")
                self.client_to_channel.pop(ws, None)
                session_id = self.client_to_session.pop(ws, None)
                if session_id is not None:
                    self.session_to_clients.pop(session_id, None)

    async def unsubscribe_channel(self, websocket: WebSocket):
        """
        取消客户端订阅视频通道的权限, 并关闭连接
        :param websocket: 客户端websocket实例
        """
        async with self.lock:
            channel = self.client_to_channel.pop(websocket, None)
            if channel is not None:
                clients = self.channel_to_clients.get(channel)
                if clients is not None:
                    clients.discard(websocket)
                    if not clients:
                        self.channel_to_clients.pop(channel, None)
                        scrcpy_service = self.channel_to_scrcpy.pop(channel, None)
                        if scrcpy_service is not None:
                            await scrcpy_service.stop()
            self.send_locks.pop(websocket, None)
            session_id = self.client_to_session.pop(websocket, None)
            if session_id is not None:
                self.session_to_clients.pop(session_id, None)

        try:
            await websocket.close(code=1000, reason="取消客户端订阅")
        except Exception as e:
            logging.error(f"关闭客户端连接时出错: {e}")
        logging.info(f"已取消客户端{id(websocket)}订阅视频通道: {channel}")

    async def subscribe_channel(self, websocket: WebSocket, device_ip: str, device_port: int):
        """
        订阅视频通道, 必要时创建服务实例
        :param websocket: 客户端websocket实例
        :param device_ip: 设备IP地址
        :param device_port: 设备端口号
        """
        channel = Channel(device_ip, device_port)
        async with self.lock:
            service = self.channel_to_scrcpy.get(channel)
            if service is None:
                service = await self.create_scrcpy_service(device_ip, device_port)
                if service is None:
                    return
                self.channel_to_scrcpy[channel] = service

            clients = self.channel_to_clients.get(channel)
            if clients is None:
                clients = set()
                self.channel_to_clients[channel] = clients
            clients.add(websocket)

            self.client_to_channel[websocket] = channel

        logging.info(
            f"{id(websocket)} 成功订阅视频通道 {channel} ，当前订阅数: {len(clients)}"
        )

    async def handle_connect_device(self, websocket: WebSocket, message_data: dict):
        """
        处理连接设备请求, 并订阅视频通道
        :param websocket: 客户端websocket实例
        :param message_data: 客户端发送的连接设备数据（已解析的dict）
        """
        try:
            message = ConnectDeviceMessage(**message_data)
        except Exception as e:
            logging.error(f"解析连接设备请求失败: {e}")
            return

        logging.info(f"收到连接设备请求: {message}")
        try:
            if message.session_id in self.session_to_clients:
                await websocket.send_text(
                    json.dumps(
                        asdict(
                            WebSocketResponse(
                                status=False,
                                response="会话已存在，无法重复连接",
                            )
                        )
                    )
                )
                return

            await self.subscribe_channel(
                websocket, message.device_ip, message.device_port
            )

            self.session_to_clients[message.session_id] = websocket
            self.client_to_session[websocket] = message.session_id

        except Exception as e:
            logging.error(f"创建设备服务失败: {e}")
            response = WebSocketResponse(
                status=False,
                response=f"{message.session_id} {message.device_ip}:{message.device_port}连接失败:{e}",
            )
            try:
                await websocket.send_text(
                    json.dumps(asdict(response))
                )
            except Exception as send_error:
                logging.error(f"发送连接失败响应出错: {send_error}")
            await self.unsubscribe_channel(websocket)
            return

        try:
            response = WebSocketResponse(
                status=True,
                response=f"{message.session_id} {message.device_ip}:{message.device_port}连接成功，开始传输视频流",
            )
            await websocket.send_text(
                json.dumps(asdict(response))
            )
        except Exception as e:
            logging.error(f"发送连接成功响应失败: {e}")
            await self.unsubscribe_channel(websocket)

    async def video_loop(
        self, scrcpy_service: ScrcpyService, ffmpeg_reader: asyncio.StreamReader
    ):
        """
        从 ffmpeg 输出管道 读取 MJPEG 字节流，按 JPEG 起止标记拆帧后广播。

        关键点：
        - 不能用 BufferedReader.read(4096) 这种"读满才返回"的 API，否则在数据不足时会表现为卡死；
        - asyncio 子进程的 StreamReader.read(n) 会在"有数据可读"时尽快返回(<=n), 不会强制等满 n 字节；
        """

        buf = bytearray()
        max_buf = 8 * 1024 * 1024

        try:
            logging.info("开始视频读取循环")
            while self.is_running():
                logging.debug("等待ffmpeg stdout 读取数据...")
                try:
                    chunk = await asyncio.wait_for(
                        ffmpeg_reader.read(4096), timeout=10.0
                    )
                except asyncio.TimeoutError:
                    logging.warning("ffmpeg stdout 读取超时，检查ffmpeg进程状态")
                    if not scrcpy_service.is_running():
                        logging.warning("scrcpy_service已退出")
                        await self.cancel_channel(
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
                    start = buf.rfind(b"\xff\xd8")
                    if start == -1:
                        buf.clear()
                    else:
                        del buf[:start]

                while True:
                    start = buf.find(b"\xff\xd8")
                    if start == -1:
                        if len(buf) > 1:
                            del buf[:-1]
                        break
                    end = buf.find(b"\xff\xd9", start + 2)
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
            return

        logging.debug(f"广播 {len(payload)} 字节数据到频道 {channel}")

        async def _safe_send(ws: WebSocket) -> bool:
            try:
                lock = self.send_locks.get(ws)
                if lock is None:
                    lock = asyncio.Lock()
                    self.send_locks[ws] = lock
                async with lock:
                    await asyncio.wait_for(ws.send_bytes(payload), timeout=0.5)
                return True
            except Exception as e:
                logging.error(f"_safe_send 异常: {e}")
                return False

        results = await asyncio.gather(
            *(_safe_send(ws) for ws in list(clients)), return_exceptions=True
        )
        for ws, ok in zip(list(clients), results):
            if ok is not True:
                try:
                    await self.unsubscribe_channel(ws)
                except Exception as e:
                    logging.error(f"关闭客户端 {id(ws)} 连接时出错: {e}")

    async def handle_client(self, websocket: WebSocket):
        """处理WebSocket客户端连接"""
        try:
            await websocket.accept()
        except Exception as e:
            logging.error(f"WebSocket握手失败: {e}")
            return

        self.send_locks.setdefault(websocket, asyncio.Lock())
        message_type_handlers = {
            WebSocketRequestType.CONNECT_DEVICE: self.handle_connect_device
        }
        try:
            while True:
                message = await websocket.receive()
                if message.get("type") == "websocket.disconnect":
                    logging.info(f"客户端 {id(websocket)} 断开连接")
                    break

                if "bytes" in message:
                    logging.warning(
                        f"收到客户端发来的二进制消息，大小: {len(message['bytes'])} 字节，跳过处理"
                    )
                    continue

                text_message = message.get("text")
                if text_message is None:
                    continue

                try:
                    obj = json.loads(text_message)
                    request = WebSocketRequest(**obj)
                    handler = message_type_handlers[request.type]
                    await handler(websocket, request.data)
                except Exception as e:
                    logging.error(f"客户端发送非法消息: {text_message}，解析异常: {e}")
                    try:
                        await websocket.send_text(
                            json.dumps(
                                asdict(
                                    WebSocketResponse(
                                        status=False,
                                        response=f"非法消息: {e}",
                                    )
                                )
                            )
                        )
                    except Exception:
                        pass
                    break

        except Exception as e:
            logging.error(f"处理客户端连接异常: {e}")
        finally:
            await self.unsubscribe_channel(websocket)

    async def create_scrcpy_service(
        self, device_ip: str, device_port: int
    ) -> Optional[ScrcpyService]:
        """创建并启动scrcpy服务"""
        service = ScrcpyService(device_ip, device_port)
        try:
            out_fifo = await service.start()
            if out_fifo is None:
                return None
            logging.info(f"scrcpy服务已启动，准备开始读取视频流: {out_fifo}")
            asyncio.create_task(self.video_loop(service, out_fifo))
            return service
        except Exception as e:
            logging.error(f"启动scrcpy服务时发生异常: {e}")
            await service.stop()
            return None

    async def stop_connect_device(self, session_id: str):
        """
        停止指定设备的scrcpy服务
        """
        client = self.session_to_clients.get(session_id, None)
        if client is not None:
            await self.unsubscribe_channel(client)

    def is_running(self) -> bool:
        """检查管理器是否运行中"""
        return self.running

    async def start(self):
        """启动服务管理器（标记运行状态）"""
        async with self.lock:
            if self.running:
                return
            self.running = True
            logging.info("scrcpy服务管理器已启动")

    async def stop(self):
        """停止所有scrcpy服务并清理资源"""
        async with self.lock:
            if not self.running:
                return
            self.running = False

            for ws in list(self.client_to_channel.keys()):
                try:
                    await ws.close(code=1000, reason="服务准备停止")
                except Exception as e:
                    logging.error(f"关闭客户端连接时出错: {e}")

            for service in self.channel_to_scrcpy.values():
                try:
                    await service.stop()
                except Exception as e:
                    logging.error(f"停止scrcpy服务时出错: {e}")

            self.send_locks.clear()
            self.channel_to_clients.clear()
            self.client_to_channel.clear()
            self.channel_to_scrcpy.clear()
            self.session_to_clients.clear()
            self.client_to_session.clear()

            logging.info("scrcpy服务管理器已停止")


# 全局服务管理器实例
scrcpy_service_manager = ScrcpyServiceManager()
